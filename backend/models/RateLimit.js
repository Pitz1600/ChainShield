const mongoose = require('mongoose');

/**
 * Rate Limit Schema
 * Persistent rate limiting that doesn't reset on page refresh
 */
const rateLimitSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Rate limit type
    limitType: {
        type: String,
        enum: ['feedback_submission', 'api_call', 'login_attempt'],
        required: true
    },

    // Daily tracking
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true,
        index: true
    },

    // Count for this period
    count: {
        type: Number,
        default: 0
    },

    // Limit threshold
    limit: {
        type: Number,
        default: 50 // Default: 50 feedback per day
    },

    // When limit was first hit
    limitReachedAt: {
        type: Date
    },

    // Reset time (next day at midnight)
    resetsAt: {
        type: Date,
        required: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
rateLimitSchema.index({ userId: 1, limitType: 1, date: 1 }, { unique: true });

// Static method to check and increment rate limit
rateLimitSchema.statics.checkAndIncrement = async function (userId, limitType = 'feedback_submission', limit = 50) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Find or create rate limit record for today
    let rateLimit = await this.findOne({
        userId,
        limitType,
        date: today
    });

    if (!rateLimit) {
        // Create new record for today
        rateLimit = await this.create({
            userId,
            limitType,
            date: today,
            count: 1,
            limit,
            resetsAt: tomorrow
        });

        return {
            allowed: true,
            count: 1,
            limit,
            remaining: limit - 1,
            resetsAt: tomorrow
        };
    }

    // Check if limit exceeded
    if (rateLimit.count >= rateLimit.limit) {
        return {
            allowed: false,
            count: rateLimit.count,
            limit: rateLimit.limit,
            remaining: 0,
            resetsAt: rateLimit.resetsAt,
            limitReachedAt: rateLimit.limitReachedAt || new Date()
        };
    }

    // Increment count
    rateLimit.count += 1;

    // Mark when limit was reached
    if (rateLimit.count >= rateLimit.limit && !rateLimit.limitReachedAt) {
        rateLimit.limitReachedAt = new Date();
    }

    await rateLimit.save();

    return {
        allowed: true,
        count: rateLimit.count,
        limit: rateLimit.limit,
        remaining: rateLimit.limit - rateLimit.count,
        resetsAt: rateLimit.resetsAt
    };
};

// Static method to get current status
rateLimitSchema.statics.getStatus = async function (userId, limitType = 'feedback_submission') {
    const today = new Date().toISOString().split('T')[0];

    const rateLimit = await this.findOne({
        userId,
        limitType,
        date: today
    });

    if (!rateLimit) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        return {
            count: 0,
            limit: 50,
            remaining: 50,
            resetsAt: tomorrow
        };
    }

    return {
        count: rateLimit.count,
        limit: rateLimit.limit,
        remaining: Math.max(0, rateLimit.limit - rateLimit.count),
        resetsAt: rateLimit.resetsAt,
        limitReachedAt: rateLimit.limitReachedAt
    };
};

// Static method to reset user's limit (admin override)
rateLimitSchema.statics.resetUserLimit = async function (userId, limitType = 'feedback_submission') {
    const today = new Date().toISOString().split('T')[0];

    return await this.findOneAndUpdate(
        { userId, limitType, date: today },
        { count: 0, limitReachedAt: null },
        { new: true }
    );
};

// Cleanup old records (run daily)
rateLimitSchema.statics.cleanup = async function (daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    return await this.deleteMany({
        date: { $lt: cutoffString }
    });
};

module.exports = mongoose.model('RateLimit', rateLimitSchema);
