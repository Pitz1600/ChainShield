const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true // Faster lookups
    }
}, { timestamps: true });

// TTL: Tokens expire automatically after 24 hours (86400 seconds)
// This matches or exceeds the max JWT expiry time
blacklistedTokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
