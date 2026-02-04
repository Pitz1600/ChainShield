const Feedback = require('../models/Feedback');
const ModelVersion = require('../models/ModelVersion');
const Transaction = require('../models/Transaction');

// Helper functions for role checking
const isAnalyst = (user) => ['analyst', 'senior_analyst', 'investigator', 'administrator'].includes(user.role);
const isAdmin = (user) => user.role === 'administrator';

/**
 * Submit analyst feedback on a transaction
 * POST /api/feedback
 */
exports.submitFeedback = async (req, res) => {
    try {
        // Only analysts and above can submit feedback
        if (!isAnalyst(req.user)) {
            return res.status(403).json({
                error: 'Only analysts can submit feedback'
            });
        }

        const {
            transactionId,
            actualFraud,
            actualCategory,
            confidence,
            notes
        } = req.body;

        // Validate input
        if (!transactionId || actualFraud === undefined) {
            return res.status(400).json({
                error: 'transactionId and actualFraud are required'
            });
        }

        // Get transaction
        const transaction = await Transaction.findById(transactionId);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Get active model version
        const activeModel = await ModelVersion.getActiveModel();
        if (!activeModel) {
            return res.status(500).json({ error: 'No active model found' });
        }

        // Extract features from transaction
        const features = {
            amount: transaction.amount,
            transactionType: transaction.transactionType,
            riskScore: transaction.riskScore,
            riskLevel: transaction.riskLevel,
            networkFeatures: transaction.networkFeatures,
            timestamp: transaction.timestamp
        };

        // Create feedback
        const feedback = await Feedback.create({
            transactionId,
            predictedRisk: transaction.riskScore,
            predictedCategory: transaction.fraudPatterns?.[0]?.type || 'Other',
            actualFraud,
            actualCategory: actualCategory || (actualFraud ? 'Other' : 'Not Fraud'),
            confidence: confidence || 3,
            analystId: req.user._id,
            analystRole: req.user.role,
            notes,
            modelVersion: activeModel.version,
            features,
            status: 'pending'
        });

        // Update live metrics
        await ModelVersion.updateLiveMetrics(
            activeModel.version,
            feedback.isCorrectPrediction
        );

        res.json({
            success: true,
            feedback,
            message: 'Feedback submitted successfully'
        });

    } catch (error) {
        console.error('Submit Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get pending feedback for review
 * GET /api/feedback/pending
 */
exports.getPendingFeedback = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({
                error: 'Only administrators can review feedback'
            });
        }

        const feedback = await Feedback.find({ status: 'pending' })
            .populate('transactionId')
            .populate('analystId', 'name email role')
            .sort({ reviewDate: -1 })
            .limit(100);

        res.json({ success: true, feedback });

    } catch (error) {
        console.error('Get Pending Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Approve feedback for training
 * POST /api/feedback/:id/approve
 */
exports.approveFeedback = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({
                error: 'Only administrators can approve feedback'
            });
        }

        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            {
                status: 'approved',
                approvedBy: req.user._id,
                approvedAt: new Date()
            },
            { new: true }
        );

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // Check if we have enough data to trigger retraining
        const approvedCount = await Feedback.countDocuments({ status: 'approved' });
        const shouldRetrain = approvedCount >= 100 && approvedCount % 100 === 0;

        res.json({
            success: true,
            feedback,
            approvedCount,
            shouldRetrain,
            message: shouldRetrain
                ? `Feedback approved. ${approvedCount} samples ready for retraining.`
                : 'Feedback approved'
        });

    } catch (error) {
        console.error('Approve Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reject feedback
 * POST /api/feedback/:id/reject
 */
exports.rejectFeedback = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({
                error: 'Only administrators can reject feedback'
            });
        }

        const { reason } = req.body;

        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            {
                status: 'rejected',
                approvedBy: req.user._id,
                approvedAt: new Date(),
                rejectionReason: reason
            },
            { new: true }
        );

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json({
            success: true,
            feedback,
            message: 'Feedback rejected'
        });

    } catch (error) {
        console.error('Reject Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get feedback statistics
 * GET /api/feedback/stats
 */
exports.getFeedbackStats = async (req, res) => {
    try {
        const activeModel = await ModelVersion.getActiveModel();

        const stats = {
            total: await Feedback.countDocuments(),
            pending: await Feedback.countDocuments({ status: 'pending' }),
            approved: await Feedback.countDocuments({ status: 'approved' }),
            rejected: await Feedback.countDocuments({ status: 'rejected' }),

            // By analyst
            byAnalyst: await Feedback.aggregate([
                {
                    $group: {
                        _id: '$analystId',
                        count: { $sum: 1 },
                        avgConfidence: { $avg: '$confidence' }
                    }
                },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Accuracy by model version
            byModelVersion: await Feedback.aggregate([
                { $match: { status: 'approved' } },
                {
                    $group: {
                        _id: '$modelVersion',
                        total: { $sum: 1 },
                        correct: {
                            $sum: { $cond: ['$isCorrectPrediction', 1, 0] }
                        }
                    }
                },
                {
                    $project: {
                        version: '$_id',
                        total: 1,
                        correct: 1,
                        accuracy: { $divide: ['$correct', '$total'] }
                    }
                },
                { $sort: { _id: -1 } }
            ])
        };

        // Current model accuracy
        if (activeModel) {
            stats.currentModelAccuracy = await Feedback.calculateAccuracy(activeModel.version);
        }

        res.json({ success: true, stats });

    } catch (error) {
        console.error('Get Feedback Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get analyst's own feedback history
 * GET /api/feedback/my-feedback
 */
exports.getMyFeedback = async (req, res) => {
    try {
        const feedback = await Feedback.find({ analystId: req.user._id })
            .populate('transactionId')
            .sort({ reviewDate: -1 })
            .limit(50);

        const stats = {
            total: feedback.length,
            pending: feedback.filter(f => f.status === 'pending').length,
            approved: feedback.filter(f => f.status === 'approved').length,
            rejected: feedback.filter(f => f.status === 'rejected').length,
            avgConfidence: feedback.reduce((sum, f) => sum + f.confidence, 0) / feedback.length || 0
        };

        res.json({ success: true, feedback, stats });

    } catch (error) {
        console.error('Get My Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = exports;
