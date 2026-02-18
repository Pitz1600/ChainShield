const cron = require('node-cron');
const axios = require('axios');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

/**
 * Monthly Security Review Scheduler
 * Triggered on the 1st of every month at midnight
 */
const scheduleSecurityReviews = () => {
    cron.schedule('0 0 1 * *', async () => {
        console.log('[SECURITY] Monthly security review triggered');

        try {
            // 1. Log the review trigger in the Audit Log
            // We attribute this to the first administrator found in the system
            const admin = await User.findOne({ role: 'administrator' });

            if (admin) {
                await AuditLog.logAction({
                    action: 'suspicious_login', // Using as a proxy for "check needed" or we can add a new action
                    userId: admin._id,
                    userRole: admin.role,
                    username: admin.username,
                    details: {
                        type: 'monthly_security_review_due',
                        message: 'The monthly security review and threat model update is due.'
                    },
                    isSuspicious: true, // Flag it so it shows up in dashboards
                    suspiciousReason: 'Scheduled Security Review Due'
                });
            }

            // 2. In a real system, you might send an email or push notification here
            console.log('✅ Monthly security review log created');
        } catch (error) {
            console.error('[SECURITY] Failed to trigger review log:', error.message);
        }
    });

    /**
     * Automated ML Model Retraining
     * Scheduled for every 15th of the month at midnight
     */
    cron.schedule('0 0 15 * *', async () => {
        console.log('[ML-SERVICE] Scheduled model retraining triggered');

        try {
            const mlUrl = process.env.ML_SERVICE_URL || 'http://ml-service:5001';
            const secret = process.env.ML_API_SECRET;

            const response = await axios.post(`${mlUrl}/train`, {}, {
                headers: { 'X-Internal-Secret': secret },
                timeout: 300000 // 5 minutes for retraining
            });

            if (response.data.success) {
                console.log('✅ ML Model retrained successfully');

                // Log success in Audit Log
                const admin = await User.findOne({ role: 'administrator' });
                await AuditLog.logAction({
                    action: 'model_retrained',
                    userId: admin ? admin._id : null,
                    userRole: admin ? admin.role : 'system',
                    username: admin ? admin.username : 'system',
                    details: {
                        method: 'automated_monthly_retrain',
                        result: response.data.message
                    }
                });
            }
        } catch (error) {
            console.error('[ML-SERVICE] Automated retraining failed:', error.message);
        }
    });

    console.log('⏰ Security: Review and Retraining schedulers active');
};

module.exports = { scheduleSecurityReviews };
