const AuditLog = require('../models/AuditLog');

/**
 * Log an audit entry
 * @param {Object} params
 * @param {string} params.action - The action performed (e.g., 'user_login', 'profile_update')
 * @param {string} params.userId - The ID of the user performing the action
 * @param {Object} params.details - Additional details about the action
 * @param {Object} params.req - Express request object (to extract IP and User Agent)
 */
const logAudit = async ({ action, userId, details = {}, req }) => {
    try {
        // Extract IP and User Agent if req is provided
        let ipAddress = 'unknown';
        let userAgent = 'unknown';

        if (req) {
            ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            userAgent = req.get('User-Agent');
        }

        // Fetch user data to populate required fields if needed
        // But AuditLog model schema requires: userId, userRole, username.
        // We might need to fetch the user if not all info is passed.
        // However, for efficiency, let's assume the caller passes userId. 
        // We need to fetch the user document to get role and username if they are required by the schema.
        // Let's check the schema again.

        const User = require('../models/User');
        const user = await User.findById(userId);

        if (!user) {
            console.warn(`AuditLog Warning: User ${userId} not found when logging ${action}`);
            return;
        }

        await AuditLog.create({
            action,
            userId,
            userRole: user.role,
            username: user.username,
            details,
            ipAddress,
            userAgent
        });

        // console.log(`AuditLog: ${action} by ${user.username}`); 
    } catch (error) {
        // Silent failure to avoid disrupting main flow
        console.error('AuditLog Error:', error.message);
    }
};

module.exports = { logAudit };
