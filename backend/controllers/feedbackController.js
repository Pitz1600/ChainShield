const Feedback = require('../models/Feedback');
const ModelVersion = require('../models/ModelVersion');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const RateLimit = require('../models/RateLimit');

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

        // Check rate limit (persistent, doesn't reset on refresh)
        const rateLimitCheck = await RateLimit.checkAndIncrement(
            req.user._id,
            'feedback_submission',
            50 // 50 feedback per day
        );

        if (!rateLimitCheck.allowed) {
            // Log rate limit hit
            await AuditLog.logAction({
                action: 'analyst_rate_limited',
                userId: req.user._id,
                userRole: req.user.role,
                username: req.user.username,
                details: {
                    count: rateLimitCheck.count,
                    limit: rateLimitCheck.limit,
                    resetsAt: rateLimitCheck.resetsAt
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                isSuspicious: rateLimitCheck.count > rateLimitCheck.limit + 10, // Suspicious if trying way over limit
                suspiciousReason: rateLimitCheck.count > rateLimitCheck.limit + 10 ? 'Excessive rate limit attempts' : null
            });

            return res.status(429).json({
                error: 'Daily feedback limit reached',
                limit: rateLimitCheck.limit,
                count: rateLimitCheck.count,
                remaining: 0,
                resetsAt: rateLimitCheck.resetsAt,
                message: `You've reached your daily limit of ${rateLimitCheck.limit} feedback submissions. Limit resets at ${new Date(rateLimitCheck.resetsAt).toLocaleString()}.`
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

        // Detect suspicious patterns
        const isSuspicious = await detectSuspiciousPattern(req.user._id, {
            actualFraud,
            confidence,
            notes,
            riskScore: transaction.riskScore
        });

        // Create feedback with AUTOMATIC APPROVAL
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
            status: 'approved',  // AUTO-APPROVED
            approvedBy: req.user._id,  // Self-approved by analyst
            approvedAt: new Date()
        });

        // Log to audit trail
        await AuditLog.logAction({
            action: 'feedback_submitted',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            feedbackId: feedback._id,
            transactionId: transaction._id,
            details: {
                actualFraud,
                confidence,
                notes: notes?.substring(0, 100), // First 100 chars
                predictedRisk: transaction.riskScore,
                autoApproved: true
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            isSuspicious: isSuspicious.suspicious,
            suspiciousReason: isSuspicious.reason
        });

        // Log auto-approval
        await AuditLog.logAction({
            action: 'feedback_auto_approved',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            feedbackId: feedback._id,
            transactionId: transaction._id,
            details: {
                approvalTime: 0, // Instant
                autoApproved: true
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Update live metrics
        await ModelVersion.updateLiveMetrics(
            activeModel.version,
            feedback.isCorrectPrediction
        );

        // Check if we should trigger retraining
        const approvedCount = await Feedback.countDocuments({ status: 'approved' });
        const shouldRetrain = approvedCount >= 100 && approvedCount % 100 === 0;

        let message = 'Feedback submitted and automatically approved';
        if (shouldRetrain) {
            message = `Feedback approved! ${approvedCount} samples collected - automatic retraining will begin shortly.`;

            // Log retraining trigger
            await AuditLog.logAction({
                action: 'model_retrained',
                userId: req.user._id,
                userRole: req.user.role,
                username: req.user.username,
                details: {
                    approvedCount,
                    modelVersion: activeModel.version,
                    triggeredBy: 'automatic'
                },
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });
        }

        res.json({
            success: true,
            feedback,
            approvedCount,
            shouldRetrain,
            message,
            rateLimit: {
                count: rateLimitCheck.count,
                limit: rateLimitCheck.limit,
                remaining: rateLimitCheck.remaining,
                resetsAt: rateLimitCheck.resetsAt
            },
            warning: isSuspicious.suspicious ? 'This submission has been flagged for admin review' : null
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

/**
 * Get audit logs (Admin only)
 * GET /api/feedback/audit-logs
 */
exports.getAuditLogs = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'Only administrators can view audit logs' });
        }

        const {
            page = 1,
            limit = 50,
            action,
            userId,
            suspicious = false,
            days = 30
        } = req.query;

        const query = {};

        // Filter by action type
        if (action) {
            query.action = action;
        }

        // Filter by user
        if (userId) {
            query.userId = userId;
        }

        // Filter by suspicious flag
        if (suspicious === 'true') {
            query.isSuspicious = true;
        }

        // Filter by date range
        if (days) {
            const since = new Date();
            since.setDate(since.getDate() - parseInt(days));
            query.createdAt = { $gte: since };
        }

        const logs = await AuditLog.find(query)
            .populate('userId', 'username email role')
            .populate('feedbackId')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit));

        const total = await AuditLog.countDocuments(query);

        // Get suspicious activity summary
        const suspiciousCount = await AuditLog.countDocuments({
            isSuspicious: true,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });

        res.json({
            success: true,
            logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            },
            summary: {
                suspiciousLast7Days: suspiciousCount
            }
        });

    } catch (error) {
        console.error('Get Audit Logs Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Flag feedback as malicious (Admin only)
 * POST /api/feedback/:id/flag
 */
exports.flagFeedback = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'Only administrators can flag feedback' });
        }

        const { reason } = req.body;

        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // Change status to rejected
        feedback.status = 'rejected';
        feedback.rejectionReason = reason || 'Flagged as malicious by admin';
        await feedback.save();

        // Log the action
        await AuditLog.logAction({
            action: 'feedback_flagged',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            feedbackId: feedback._id,
            transactionId: feedback.transactionId,
            details: {
                reason,
                previousStatus: 'approved',
                newStatus: 'rejected',
                flaggedBy: req.user.username
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            feedback,
            message: 'Feedback flagged and removed from training dataset'
        });

    } catch (error) {
        console.error('Flag Feedback Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get rate limit status
 * GET /api/feedback/rate-limit-status
 */
exports.getRateLimitStatus = async (req, res) => {
    try {
        const status = await RateLimit.getStatus(req.user._id, 'feedback_submission');

        res.json({
            success: true,
            rateLimit: status
        });

    } catch (error) {
        console.error('Get Rate Limit Status Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Reset user's rate limit (Admin only)
 * POST /api/feedback/reset-rate-limit/:userId
 */
exports.resetRateLimit = async (req, res) => {
    try {
        if (!isAdmin(req.user)) {
            return res.status(403).json({ error: 'Only administrators can reset rate limits' });
        }

        const result = await RateLimit.resetUserLimit(req.params.userId, 'feedback_submission');

        // Log the action
        await AuditLog.logAction({
            action: 'rate_limit_reset',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            details: {
                targetUserId: req.params.userId,
                resetBy: req.user.username
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Rate limit reset successfully',
            rateLimit: result
        });

    } catch (error) {
        console.error('Reset Rate Limit Error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Helper function to detect suspicious patterns
 */
async function detectSuspiciousPattern(userId, feedbackData) {
    try {
        // Get user's recent feedback
        const recentFeedback = await Feedback.find({
            analystId: userId,
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        });

        const reasons = [];

        // Pattern 1: All submissions say "not fraud" for high-risk transactions
        const highRiskNotFraud = recentFeedback.filter(f =>
            f.predictedRisk >= 70 && f.actualFraud === false
        );
        if (highRiskNotFraud.length >= 5) {
            reasons.push('Multiple high-risk transactions marked as not fraud');
        }

        // Pattern 2: Very low confidence submissions
        if (feedbackData.confidence <= 2 && recentFeedback.filter(f => f.confidence <= 2).length >= 3) {
            reasons.push('Multiple low-confidence submissions');
        }

        // Pattern 3: Minimal notes
        if ((!feedbackData.notes || feedbackData.notes.length < 20) &&
            recentFeedback.filter(f => !f.notes || f.notes.length < 20).length >= 3) {
            reasons.push('Insufficient investigation notes');
        }

        // Pattern 4: Too many submissions in short time
        if (recentFeedback.length >= 20) {
            reasons.push('Unusually high submission rate');
        }

        // Pattern 5: Always contradicting AI (either always agree or always disagree)
        const alwaysDisagree = recentFeedback.filter(f => {
            const aiSaysFraud = f.predictedRisk >= 60;
            return aiSaysFraud !== f.actualFraud;
        });
        if (alwaysDisagree.length >= 10 && alwaysDisagree.length === recentFeedback.length) {
            reasons.push('Always contradicting AI predictions');
        }

        return {
            suspicious: reasons.length > 0,
            reason: reasons.join('; ')
        };

    } catch (error) {
        console.error('Detect Suspicious Pattern Error:', error);
        return { suspicious: false, reason: null };
    }
}

module.exports = exports;

