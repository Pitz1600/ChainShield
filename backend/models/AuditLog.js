const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Audit Log Schema
 * Tracks all feedback submissions and admin actions for security and compliance
 */
const auditLogSchema = new mongoose.Schema({
    // Action Details
    action: {
        type: String,
        enum: [
            'feedback_submitted',
            'feedback_approved',
            'feedback_rejected',
            'feedback_deleted',
            'feedback_auto_approved',
            'feedback_flagged',
            'feedback_removed',
            'model_retrained',
            'analyst_rate_limited',
            // User Actions
            'user_login',
            'user_login_otp',
            'oauth_login',       // Google SSO login
            'user_register',
            'user_verified',
            'user_logout',
            'login_failed',
            // 2FA Actions
            'totp_setup',
            'totp_disabled',
            // Device Actions
            'new_device_detected',
            'device_added',
            'suspicious_login',
            // Email Change
            'email_change_attempt',
            'email_changed',
            // Password Actions
            'forced_password_change',
            'password_reset_requested',
            'password_reset_completed',
            'password_changed',
            // Admin Actions
            'admin_invite',
            'admin_update_user_role',
            'admin_deactivate_user',
            'admin_activate_user',
            'admin_update_user',
            'admin_create_user',
            'admin_delete_user',
            // Profile Picture Actions
            'profile_picture_update',
            'profile_picture_delete',
            // System Actions
            'db_reset',
            // Transactions
            'transactions_imported_csv',
            'transaction_verified',
            'transaction_denied',
            'Viewed Feedbacks',
            'Viewed Auth',
            'Viewed transaction alerts',
            'Viewed Analytics',
            'Viewed system alerts',
            'Updated Transactions'
        ],
        required: true,
        index: true
    },

    // User Information
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    userRole: {
        type: String,
        required: false
    },
    username: {
        type: String,
        required: false
    },

    // Related Resources
    feedbackId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feedback',
        index: true
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    },

    // Action Details
    details: {
        type: mongoose.Schema.Types.Mixed,
        // Can include:
        // - actualFraud: boolean
        // - confidence: number
        // - notes: string
        // - reason: string (for flagging/removal)
        // - previousStatus: string
        // - newStatus: string
    },

    // Security Information
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },

    // Flags for suspicious activity
    isSuspicious: {
        type: Boolean,
        default: false,
        index: true
    },
    suspiciousReason: {
        type: String
    },

    // Admin Review
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: {
        type: Date
    },
    reviewNotes: {
        type: String
    },

    // Cryptographic Tamper Protection
    hash: {
        type: String,
        index: true
    },
    previousHash: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for performance
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ isSuspicious: 1, createdAt: -1 });

// Static method to log action with cryptographic hashing
auditLogSchema.statics.logAction = async function (data) {
    try {
        // 1. Get the previous log entry's hash to create a chain
        const lastLog = await this.findOne().sort({ createdAt: -1 });
        const previousHash = lastLog ? lastLog.hash : '0000000000000000000000000000000000000000000000000000000000000000';

        // 2. Prepare log entry content
        const logEntry = {
            action: data.action,
            userId: data.userId,
            userRole: data.userRole,
            username: data.username,
            feedbackId: data.feedbackId,
            transactionId: data.transactionId,
            details: data.details,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            isSuspicious: data.isSuspicious || false,
            suspiciousReason: data.suspiciousReason,
            previousHash: previousHash,
            timestamp: new Date().toISOString()
        };

        // 3. Create SHA-256 hash of the entry + previous hash
        const entryString = JSON.stringify(logEntry);
        const hash = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
            .update(entryString + previousHash)
            .digest('hex');

        logEntry.hash = hash;

        // 4. Save the entry
        return await this.create(logEntry);
    } catch (error) {
        console.error('Audit Log Error:', error);
        // Don't fail the main operation if logging fails
    }
};

// Static method to get user activity
auditLogSchema.statics.getUserActivity = async function (userId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await this.find({
        userId,
        createdAt: { $gte: since }
    }).sort({ createdAt: -1 });
};

// Static method to get suspicious activity
auditLogSchema.statics.getSuspiciousActivity = async function (days = 7) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await this.find({
        isSuspicious: true,
        createdAt: { $gte: since }
    })
        .populate('userId', 'username email role')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
