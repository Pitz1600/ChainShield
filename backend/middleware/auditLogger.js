const AuditLog = require('../models/AuditLog');

/**
 * Middleware to log audit events
 * @param {string} action - The action type to log
 * @param {function} detailsExtractor - Optional function to extract details from req/res
 */
const auditLogger = (action, detailsExtractor = null) => {
    return async (req, res, next) => {
        // Capture start time if needed, but we mostly care about the end result
        const originalEnd = res.end;

        // Hook into response finish to log after action is complete
        res.on('finish', async () => {
            // Only log successful actions (2xx or 3xx) or specific failures if needed
            // For now, let's log everything but maybe mark failures in details

            if (res.statusCode >= 400) {
                // Option: Log failures? 
                // If the action failed (e.g. invalid login), we might still want to log it if it's security critical.
                // For now, let's log it.
            }

            try {
                let details = {};

                // Extract details if extractor provided
                if (detailsExtractor) {
                    try {
                        details = detailsExtractor(req, res);
                    } catch (e) {
                        console.error('Error extracting audit details:', e);
                        details = { error: 'Failed to extract details' };
                    }
                }

                // Default details if not provided
                if (Object.keys(details).length === 0) {
                    if (req.params && Object.keys(req.params).length > 0) details.params = req.params;
                    // Avoid logging entire body for privacy/security, but specific fields might be needed
                }

                // Capture details about the response status if it was an error
                if (res.statusCode >= 400) {
                    details.statusCode = res.statusCode;
                    details.statusMessage = res.statusMessage;
                }

                const logData = {
                    action,
                    userId: req.user ? req.user.id : null,
                    userRole: req.user ? req.user.role : 'anonymous',
                    username: req.user ? req.user.username : (req.body.email || 'anonymous'), // Fallback for login/register
                    ipAddress: req.ip || req.connection.remoteAddress,
                    userAgent: req.get('User-Agent'),
                    details
                };

                // If no user (e.g. failed login), we might want to skip or log as partial
                // The AuditLog model requires userId, userRole, username.
                // If the user is not authenticated (e.g. login endpoint), we need to handle that.

                // For login specifically, req.user might be set by the controller if successful, 
                // BUT middleware runs before controller usually.
                // Wait, middleware runs *around* controller? No, `res.on('finish')` runs after.
                // So if login was successful, `req.user` might be populated IF the controller attached it 
                // OR if we extracted it from the token in the response?
                // The standard auth middleware attaches req.user. 
                // Login controller typically responds with token. It doesn't attach req.user to req usually.

                // If it's a protected route, req.user is there.
                // If it's public (login), req.user is MISSING.

                // Handling public routes (Login/Register):
                if (!logData.userId) {
                    // Try to recover from response or request?
                    // Hard to get userId from efficient login response without parsing body again or hooking `res.json`.
                    // For now, if no userId, we might need to rely on what we have.

                    // Actually, for login, we can pass a detailsExtractor that checks `req.body.email`.
                    // But we still need a userId for the Mongoose model which is ObjectId ref 'User'.
                    // If we don't have a userId, the model validation will fail.

                    // Modification: Make userId optional in Schema or find it?
                    // Better: In the controller, explicitly call AuditLog.logAction.
                    // The middleware approach is great for authenticated routes.
                    // A mix might be needed.

                    // Use 'anonymous' user ID or null?
                    // Model says: required: true.

                    // Let's defer logging for Login/Register to the controller directly 
                    // OR assume this middleware is mostly for ADMIN/User actions where they are logged in.

                    // If we want to use this for everything, we might need to fetch the user by email if missing 
                    // (expensive) or just fail gracefully.

                    if (['user_login', 'user_register'].includes(action)) {
                        // login/register should be handled manually in controller to get the user ID
                        return;
                    }
                }

                await AuditLog.logAction(logData);

            } catch (error) {
                console.error('Audit Logger Error:', error);
            }
        });

        next();
    };
};

module.exports = auditLogger;
