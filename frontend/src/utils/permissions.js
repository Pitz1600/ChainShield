/**
 * Permission System for ChainShield
 * Matches backend permission matrix
 */

// Permission matrix - must match backend/middleware/roleMiddleware.js
export const PERMISSIONS = {
    resident: [
        'view_public_records',
        'verify_documents',
        'track_transactions',
        'submit_complaints',
        'view_bidding_summaries',
    ],

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

    auditor: [
        'view_public_records',
        'track_transactions',
        'view_analytics',
        'view_fraud_cases',
        'view_verification_results',
        'monitor_logs',
        'generate_reports',
    ],

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
        'manage_security',
    ],
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with role property
 * @param {String} permission - Permission to check
 * @returns {Boolean}
 */
export const hasPermission = (user, permission) => {
    if (!user || !user.role) return false;

    const userPermissions = PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
};

/**
 * Check if user has one of the allowed roles
 * @param {Object} user - User object with role property
 * @param {String|Array} allowedRoles - Single role or array of roles
 * @returns {Boolean}
 */
export const canAccess = (user, allowedRoles) => {
    if (!user || !user.role) return false;

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(user.role);
};

/**
 * Check if user is administrator
 * @param {Object} user - User object with role property
 * @returns {Boolean}
 */
export const isAdmin = (user) => {
    return user?.role === 'administrator';
};

/**
 * Check if user is barangay official or higher
 * @param {Object} user - User object with role property
 * @returns {Boolean}
 */
export const isOfficial = (user) => {
    return canAccess(user, ['barangay_official', 'administrator']);
};



/**
 * Get user-friendly role name
 * @param {String} role - Role identifier
 * @returns {String}
 */
export const getRoleName = (role) => {
    const roleNames = {
        resident: 'Resident',
        barangay_official: 'Barangay Official',
        administrator: 'Administrator',
        auditor: 'Auditor',
        analyst: 'Analyst',
        investigator: 'Investigator',
    };

    return roleNames[role] || role;
};

/**
 * Get all permissions for a role
 * @param {String} role - Role identifier
 * @returns {Array}
 */
export const getRolePermissions = (role) => {
    return PERMISSIONS[role] || [];
};
