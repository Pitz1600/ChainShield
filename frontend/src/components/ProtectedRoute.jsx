import React from 'react';
import { canAccess, hasPermission } from '../utils/permissions';

/**
 * ProtectedRoute Component
 * Renders children only if user has required role or permission
 */
const ProtectedRoute = ({
    children,
    user,
    requiredRole,
    requiredPermission,
    fallback = null
}) => {
    // Check role-based access
    if (requiredRole && !canAccess(user, requiredRole)) {
        return fallback;
    }

    // Check permission-based access
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
        return fallback;
    }

    return children;
};

export default ProtectedRoute;
