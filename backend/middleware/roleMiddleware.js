/**
 * Role-Based Access Control Middleware
 * Enforces permissions based on user roles
 */

/**
 * Permission matrix for ChainShield
 */
const PERMISSIONS = {
    // Resident permissions
    resident: [
        'view_public_records',
        'verify_documents',
        'track_transactions',
        'submit_complaints',
        'view_bidding_summaries',
    ],

    // Barangay Official permissions (includes all resident permissions)
    barangay_official: [
        'view_public_records',
        'verify_documents',
        'track_transactions',
        'submit_complaints',
        'view_bidding_summaries',
        'import_documents',
        'submit_transactions',
        'initiate_bidding',
        'view_analytics',
        'respond_complaints',
        'view_verification_results',
    ],

    // Administrator permissions (includes all permissions)
    administrator: [
        'view_public_records',
        'verify_documents',
        'track_transactions',
        'submit_complaints',
        'view_bidding_summaries',
        'import_documents',
        'submit_transactions',
        'initiate_bidding',
        'view_analytics',
        'respond_complaints',
        'view_verification_results',
        'manage_users',
        'manage_roles',
        'configure_system',
        'monitor_logs',
        'validate_documents',
        'override_records',
        'generate_reports',
        'manage_security',
        'view_fraud_cases',
    ],
};

/**
 * Check if user has required role
 * @param {Array|String} allowedRoles - Single role or array of allowed roles
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.',
                requiredRole: roles,
                userRole: req.user.role
            });
        }

        next();
    };
};

/**
 * Check if user has specific permission
 * @param {String} permission - Required permission
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userPermissions = PERMISSIONS[req.user.role] || [];

        if (!userPermissions.includes(permission)) {
            return res.status(403).json({
                error: 'Access denied. You do not have permission to perform this action.',
                requiredPermission: permission,
                userRole: req.user.role
            });
        }

        next();
    };
};

/**
 * Check if user is administrator
 */
const requireAdmin = requireRole('administrator');

/**
 * Check if user is barangay official or higher
 */
const requireOfficial = requireRole(['barangay_official', 'administrator']);

/**
 * Check if user can view flagged cases (analyst, investigator, or admin)
 * Note: Keeping backward compatibility with old roles
 */
const requireFraudAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles = ['administrator', 'analyst', 'investigator'];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
            error: 'Access denied. Case review access requires analyst, investigator, or administrator role.',
            userRole: req.user.role
        });
    }

    next();
};

module.exports = {
    requireRole,
    requirePermission,
    requireAdmin,
    requireOfficial,
    requireFraudAccess,
    PERMISSIONS,
};
