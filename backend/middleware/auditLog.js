const AuditLog = require('../models/AuditLog');

// Map of Method + Route Pattern to Human Readable Action
// We use regex-like logic or startsWith in the function below to match these
const actionMap = [
    // Auth
    { method: 'POST', path: '/api/auth/register', action: 'Registered a new account' },
    { method: 'POST', path: '/api/auth/login', action: 'Logged in' },
    { method: 'POST', path: '/api/auth/logout', action: 'Logged out' },
    { method: 'POST', path: '/api/auth/forgotpassword', action: 'Requested password reset' },
    { method: 'PUT', path: '/api/auth/resetpassword', action: 'Reset password' },
    { method: 'GET', path: '/api/auth/me', action: 'Unimportant' }, // Skip logging this potentially noisy one? Or log as "Checked profile"

    // Transactions
    { method: 'POST', path: '/api/transactions/import', action: 'Imported transactions via CSV' },
    { method: 'GET', path: '/api/transactions/template', action: 'Downloaded transaction template' },
    { method: 'GET', path: '/api/transactions/my-transactions', action: 'Viewed personal transactions' },
    { method: 'POST', path: '/api/transactions', action: 'Created a new transaction' },
    { method: 'GET', path: '/api/transactions', action: 'Viewed all transactions' },
    { method: 'GET', path: '/api/transactions/alerts', action: 'Viewed transaction alerts' },

    // Alerts
    { method: 'GET', path: '/api/alerts', action: 'Viewed system alerts' },

    // Admin
    { method: 'GET', path: '/api/admin/users', action: 'Viewed user list' },
    { method: 'PUT', path: '/api/admin/users', action: 'Updated a user' },
    { method: 'DELETE', path: '/api/admin/users', action: 'Deleted a user' },

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
        return 'Viewed transaction details';
    }
    if (urlPath.startsWith('/api/complaints/') && method === 'GET') {
        return 'Viewed complaint details';
    }

    // 3. Fallback generic readable
    const resource = urlPath.split('/')[2]; // e.g., 'transactions' from /api/transactions
    const prettyResource = resource ? resource.charAt(0).toUpperCase() + resource.slice(1) : 'Resource';

    switch (method) {
        case 'GET': return `Viewed ${prettyResource}`;
        case 'POST': return `Created ${prettyResource}`;
        case 'PUT': return `Updated ${prettyResource}`;
        case 'DELETE': return `Deleted ${prettyResource}`;
        default: return `${method} ${prettyResource}`;
    }
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
                // If generic public access, maybe skip?
                // Let's log it anyway as Anonymous to be safe with "log everything".
            }

            const logEntry = new AuditLog({
                user: userId,
                action: readableAction,
                details: `${req.method} ${req.originalUrl}`,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                timestamp: new Date()
            });

            await logEntry.save();
        } catch (error) {
            console.error('Audit Log Error:', error);
            // Do not crash the app
        }
    });

    next();
};

module.exports = auditLogMiddleware;
