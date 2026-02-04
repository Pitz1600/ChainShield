const mongoose = require('mongoose');

/**
 * Model Version Schema
 * Tracks ML model versions, performance metrics, and deployment status
 */
const modelVersionSchema = new mongoose.Schema({
    version: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Training Information
    trainedAt: {
        type: Date,
        default: Date.now
    },
    trainingDataSize: {
        type: Number,
        required: true
    },
    trainingDuration: {
        type: Number, // seconds
        required: true
    },

    // Performance Metrics
    accuracy: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    precision: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    recall: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },
    f1Score: {
        type: Number,
        required: true,
        min: 0,
        max: 1
    },

    // Additional Metrics
    performanceMetrics: {
        auc: Number,
        confusionMatrix: {
            truePositives: Number,
            falsePositives: Number,
            trueNegatives: Number,
            falseNegatives: Number
        },
        classificationReport: mongoose.Schema.Types.Mixed
    },

    // Deployment Status
    isActive: {
        type: Boolean,
        default: false,
        index: true
    },
    deployedAt: {
        type: Date
    },
    deploymentStrategy: {
        type: String,
        enum: ['immediate', 'canary', 'blue-green', 'rolling'],
        default: 'canary'
    },
    canaryPercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 10
    },

    // Rollback Information
    previousVersion: {
        type: String,
        ref: 'ModelVersion'
    },
    rollbackVersion: {
        type: String,
        ref: 'ModelVersion'
    },

    // Model Artifacts
    modelPath: {
        type: String,
        required: true
    },
    modelSize: {
        type: Number // bytes
    },
    modelHash: {
        type: String // SHA-256 hash for integrity
    },

    // Validation Results
    validationResults: {
        accuracyCheck: Boolean,
        biasCheck: Boolean,
        stabilityCheck: Boolean,
        adversarialCheck: Boolean,
        overallValid: Boolean
    },

    // Live Performance Tracking
    liveMetrics: {
        totalPredictions: {
            type: Number,
            default: 0
        },
        correctPredictions: {
            type: Number,
            default: 0
        },
        liveAccuracy: {
            type: Number,
            default: 0
        },
        lastUpdated: Date
    },

    // Metadata
    description: String,
    trainingConfig: mongoose.Schema.Types.Mixed,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Deactivation
    deactivatedAt: Date,
    deactivationReason: String
}, {
    timestamps: true
});

// Indexes
modelVersionSchema.index({ isActive: 1, deployedAt: -1 });
modelVersionSchema.index({ version: 1 });

// Ensure only one active model
modelVersionSchema.pre('save', async function (next) {
    if (this.isModified('isActive') && this.isActive) {
        // Deactivate all other models
        await this.constructor.updateMany(
            { _id: { $ne: this._id }, isActive: true },
            {
                $set: {
                    isActive: false,
                    deactivatedAt: new Date(),
                    deactivationReason: `Replaced by version ${this.version}`
                }
            }
        );
    }
    next();
});

// Static method to get active model
modelVersionSchema.statics.getActiveModel = async function () {
    return await this.findOne({ isActive: true });
};

// Static method to update live metrics
modelVersionSchema.statics.updateLiveMetrics = async function (version, isCorrect) {
    const model = await this.findOne({ version });
    if (!model) return;

    model.liveMetrics.totalPredictions += 1;
    if (isCorrect) {
        model.liveMetrics.correctPredictions += 1;
    }

    model.liveMetrics.liveAccuracy =
        model.liveMetrics.correctPredictions / model.liveMetrics.totalPredictions;
    model.liveMetrics.lastUpdated = new Date();

    await model.save();
};

// Static method to deploy model
modelVersionSchema.statics.deployModel = async function (version, strategy = 'canary') {
    const model = await this.findOne({ version });
    if (!model) throw new Error(`Model version ${version} not found`);

    // Validate before deployment
    if (!model.validationResults?.overallValid) {
        throw new Error('Model failed validation checks');
    }

    model.isActive = true;
    model.deployedAt = new Date();
    model.deploymentStrategy = strategy;

    await model.save();

    return model;
};

// Static method to rollback
modelVersionSchema.statics.rollback = async function (toVersion) {
    const targetModel = await this.findOne({ version: toVersion });
    if (!targetModel) throw new Error(`Version ${toVersion} not found`);

    const currentModel = await this.getActiveModel();

    // Deactivate current
    if (currentModel) {
        currentModel.isActive = false;
        currentModel.deactivatedAt = new Date();
        currentModel.deactivationReason = `Rolled back to ${toVersion}`;
        await currentModel.save();
    }

    // Activate target
    targetModel.isActive = true;
    targetModel.deployedAt = new Date();
    await targetModel.save();

    return targetModel;
};

module.exports = mongoose.model('ModelVersion', modelVersionSchema);
