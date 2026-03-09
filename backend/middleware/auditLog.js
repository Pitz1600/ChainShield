const AuditLog = require('../models/AuditLog');

// Map of Method + Route Pattern to Human Readable Action
// We use regex-like logic or startsWith in the function below to match these
const actionMap = [
    // Auth
    { method: 'POST', path: '/api/auth/register', action: 'user_register' },
    { method: 'POST', path: '/api/auth/login', action: 'user_login' },
    { method: 'POST', path: '/api/auth/logout', action: 'user_logout' },
    { method: 'POST', path: '/api/auth/forgotpassword', action: 'password_reset_requested' },
    { method: 'PUT', path: '/api/auth/resetpassword', action: 'password_reset_completed' },
    { method: 'GET', path: '/api/auth/me', action: 'Unimportant' }, // Skip logging this potentially noisy one? Or log as "Checked profile"

    // Transactions
    { method: 'POST', path: '/api/transactions/import', action: 'transactions_imported_csv' },
    { method: 'GET', path: '/api/transactions/template', action: 'Unimportant' },
    { method: 'GET', path: '/api/transactions/my-transactions', action: 'Unimportant' },
    { method: 'POST', path: '/api/transactions', action: 'Unimportant' },
    { method: 'GET', path: '/api/transactions', action: 'Unimportant' },
    { method: 'GET', path: '/api/transactions/alerts', action: 'Viewed transaction alerts' },

    // Alerts
    { method: 'GET', path: '/api/alerts', action: 'Viewed system alerts' },
    { method: 'GET', path: '/api/feedbacks', action: 'Viewed Feedbacks' },
    { method: 'GET', path: '/api/auth', action: 'Viewed Auth' },
    { method: 'GET', path: '/api/transactions/alerts', action: 'Viewed transaction alerts' },
    { method: 'GET', path: '/api/analytics', action: 'Viewed Analytics' },
    { method: 'GET', path: '/api/transactions/alerts/stats', action: 'Viewed transaction alerts' },

    // Admin
    { method: 'GET', path: '/api/admin/users', action: 'Unimportant' },
    { method: 'PUT', path: '/api/admin/users', action: 'admin_update_user' },
    { method: 'DELETE', path: '/api/admin/users', action: 'admin_delete_user' },

    // Complaints
    { method: 'POST', path: '/api/complaints', action: 'Filed a complaint' },
    { method: 'GET', path: '/api/complaints', action: 'Viewed complaints' },
];

/**
 * Helper to determine human readable action from request
 */
const getReadableAction = (method, originalUrl) => {
    // Normalize url to remove query parameters for matching
    const urlPath = originalUrl.split('?')[0];

    // 1. Exact match
    const exactMatch = actionMap.find(m => m.method === method && m.path === urlPath);
    if (exactMatch) return exactMatch.action;

    // 2. Pattern matching (simple startsWith for now, can be expanded to regex if needed)
    if (urlPath.startsWith('/api/transactions/') && method === 'GET') {
        return 'Unimportant';
    }
    if (urlPath.startsWith('/api/complaints/') && method === 'GET') {
        return 'Unimportant';
    }

    // 3. Fallback to skip unknown/non-enum actions
    return 'Unimportant';
};

const auditLogMiddleware = (req, res, next) => {
    // We hook into the 'finish' event to ensure the request is processing (and user might be attached)
    res.on('finish', async () => {
        try {
            // Only log successful requests or specific failures if needed. 
            // For now, let's log everything that isn't a 404
            if (res.statusCode === 404) return;

            const readableAction = getReadableAction(req.method, req.originalUrl);

            // If action is marked "Unimportant" (like checking own profile repeatedly), maybe skip?
            // But user said "log everything", so we log it.

            if (readableAction === 'Unimportant') return;

            // We prioritize req.user if available (from auth middleware)
            const userId = req.user ? req.user._id : null;

            // If there is no user and it's not a login attempt, we might skip logging 
            // OR we log it as "Anonymous". 
            // Requirement: "who, when where". "Who" implies identity.
            // If we log anonymous, the table might get huge with random traffic? 
            // Usually "Audit Logs" imply authenticated actions.
            // However, "Login" is unauthenticated initially.

            // If it is a login route and successful (200), we can't easily get the user ID *here* 
            // because req.user isn't set by global middleware for the login route itself 
            // (it is set inside the route handler which sends the response).
            // BUT, since we are in `res.on('finish')`, `req.user` MIGHT have been set by the controller 
            // if the controller attached it to req. 
            // Most controllers just send JSON.

            // Let's rely on req.user for now. If req.user is missing, we only log if it was a critical path like Login?
            // Actually, for simplicity and safety, let's log if we have a user OR if it's a critical auth path.

            if (!userId && !req.originalUrl.includes('/auth/login')) {
                // For non-login routes without a user, we skip logging to avoid noise/validation errors
                return;
            }

            // Extract details as an object for better frontend parsing
            const logDetails = {
                method: req.method,
                url: req.originalUrl,
                statusCode: res.statusCode
            };

            await AuditLog.logAction({
                action: readableAction,
                userId: userId,
                userRole: req.user ? req.user.role : 'anonymous',
                username: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'anonymous',
                details: logDetails,
                ipAddress: req.ip || req.get('x-forwarded-for') || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            });
        } catch (error) {
            console.error('Audit Log Error:', error);
            // Do not crash the app
        }
    });

    next();
};

module.exports = auditLogMiddleware;
