const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * Trusted Device Model
 * Tracks known devices/IPs for each user to detect new login locations
 */
const trustedDeviceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    deviceHash: {
        type: String,
        required: true
    },
    ipHash: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    label: {
        type: String  // e.g., "Chrome on Windows"
    },
    lastUsed: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expireAfterSeconds: 0 } // TTL index - MongoDB auto-deletes expired docs
    }
}, { timestamps: true });

// Compound index for fast lookups
trustedDeviceSchema.index({ userId: 1, deviceHash: 1, ipHash: 1 });

/**
 * Generate a device fingerprint hash from user agent + IP
 */
trustedDeviceSchema.statics.generateDeviceHash = function (userAgent) {
    return crypto.createHash('sha256').update(userAgent || 'unknown').digest('hex').substring(0, 16);
};

trustedDeviceSchema.statics.generateIpHash = function (ip) {
    return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').substring(0, 16);
};

/**
 * Check if a device is trusted for a user
 */
trustedDeviceSchema.statics.isDeviceTrusted = async function (userId, userAgent, ip) {
    const deviceHash = this.generateDeviceHash(userAgent);
    const ipHash = this.generateIpHash(ip);

    const device = await this.findOne({
        userId,
        deviceHash,
        ipHash,
        expiresAt: { $gt: new Date() }
    });

    if (device) {
        // Update last used
        device.lastUsed = new Date();
        await device.save();
        return true;
    }

    return false;
};

/**
 * Add a trusted device (remember this device for 30 days)
 */
trustedDeviceSchema.statics.addTrustedDevice = async function (userId, userAgent, ip) {
    const deviceHash = this.generateDeviceHash(userAgent);
    const ipHash = this.generateIpHash(ip);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Parse user agent for label
    let label = 'Unknown Device';
    if (userAgent) {
        if (userAgent.includes('Chrome')) label = 'Chrome';
        else if (userAgent.includes('Firefox')) label = 'Firefox';
        else if (userAgent.includes('Safari')) label = 'Safari';
        else if (userAgent.includes('Edge')) label = 'Edge';
        if (userAgent.includes('Windows')) label += ' on Windows';
        else if (userAgent.includes('Mac')) label += ' on Mac';
        else if (userAgent.includes('Linux')) label += ' on Linux';
        else if (userAgent.includes('Android')) label += ' on Android';
        else if (userAgent.includes('iPhone')) label += ' on iPhone';
    }

    // Upsert: update if exists, create if not
    return await this.findOneAndUpdate(
        { userId, deviceHash, ipHash },
        {
            userId, deviceHash, ipHash, userAgent, label,
            lastUsed: new Date(),
            expiresAt
        },
        { upsert: true, new: true }
    );
};

/**
 * Remove all trusted devices for a user (e.g., on password reset)
 */
trustedDeviceSchema.statics.removeAllForUser = async function (userId) {
    return await this.deleteMany({ userId });
};

module.exports = mongoose.model('TrustedDevice', trustedDeviceSchema);
