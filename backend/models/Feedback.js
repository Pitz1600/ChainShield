const mongoose = require('mongoose');

/**
 * Analyst Feedback Schema
 * Stores analyst decisions on AI predictions for model retraining
 */
const feedbackSchema = new mongoose.Schema({
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        required: true,
        index: true
    },

    // AI Prediction
    predictedRisk: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    predictedCategory: {
        type: String,
        enum: ['Procurement Anomaly', 'Tax Anomaly', 'Welfare Anomaly', 'Identity Anomaly', 'Money Laundering Anomaly', 'Other']
    },

    // Analyst Assessment
    actualFraud: {
        type: Boolean,
        required: true
    },
    actualCategory: {
        type: String,
        enum: ['Procurement Anomaly', 'Tax Anomaly', 'Welfare Anomaly', 'Identity Anomaly', 'Money Laundering Anomaly', 'Other', 'Not Fraud']
    },
    confidence: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        default: 3
    },

    // Analyst Information
    analystId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    analystRole: {
        type: String,
        required: true
    },
    reviewDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String,
        maxlength: 1000
    },

    // Model Information
    modelVersion: {
        type: String,
        required: true,
        index: true
    },
    features: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },

    // Approval Workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        index: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    },

    // Quality Metrics
    isCorrectPrediction: {
        type: Boolean
    },
    predictionError: {
        type: Number
    }
}, {
    timestamps: true
});

// Indexes for performance
feedbackSchema.index({ status: 1, approvedAt: -1 });
feedbackSchema.index({ modelVersion: 1, status: 1 });
feedbackSchema.index({ analystId: 1, reviewDate: -1 });

// Calculate if prediction was correct
feedbackSchema.pre('save', function (next) {
    if (this.isModified('actualFraud') || this.isModified('predictedRisk')) {
        // Consider prediction correct if:
        // - AI predicted high risk (>=60) and analyst confirmed fraud
        // - AI predicted low risk (<60) and analyst confirmed not fraud
        const aiPredictedFraud = this.predictedRisk >= 60;
        this.isCorrectPrediction = (aiPredictedFraud === this.actualFraud);

        // Calculate error
        const actualRisk = this.actualFraud ? 100 : 0;
        this.predictionError = Math.abs(this.predictedRisk - actualRisk);
    }
    next();
});

// Static method to get training data
feedbackSchema.statics.getTrainingData = async function (limit = 1000) {
    const feedback = await this.find({ status: 'approved' })
        .sort({ approvedAt: -1 })
        .limit(limit)
        .populate('transactionId');

    return feedback.map(f => ({
        features: f.features,
        label: f.actualFraud ? 1 : 0,
        weight: f.confidence / 5, // Higher confidence = higher weight
        transactionId: f.transactionId._id
    }));
};

// Static method to calculate model accuracy
feedbackSchema.statics.calculateAccuracy = async function (modelVersion) {
    const feedback = await this.find({
        modelVersion,
        status: 'approved'
    });

    if (feedback.length === 0) return null;

    const correct = feedback.filter(f => f.isCorrectPrediction).length;
    const total = feedback.length;

    const truePositives = feedback.filter(f => f.predictedRisk >= 60 && f.actualFraud).length;
    const falsePositives = feedback.filter(f => f.predictedRisk >= 60 && !f.actualFraud).length;
    const trueNegatives = feedback.filter(f => f.predictedRisk < 60 && !f.actualFraud).length;
    const falseNegatives = feedback.filter(f => f.predictedRisk < 60 && f.actualFraud).length;

    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
        accuracy: correct / total,
        precision,
        recall,
        f1Score,
        totalSamples: total,
        confusionMatrix: {
            truePositives,
            falsePositives,
            trueNegatives,
            falseNegatives
        }
    };
};

module.exports = mongoose.model('Feedback', feedbackSchema);
