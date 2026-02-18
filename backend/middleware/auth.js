const jwt = require('jsonwebtoken');
const User = require('../models/User');
const BlacklistedToken = require('../models/BlacklistedToken');

module.exports = async (req, res, next) => {
  try {
    // Try cookie first, then header (for backward compatibility or testing)
    let token = req.cookies?.token;
    if (!token) {
      token = req.header('Authorization')?.replace('Bearer ', '');
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // SECURITY: Check database blacklist
    const isBlacklisted = await BlacklistedToken.exists({ token });
    if (isBlacklisted) {
      console.log('[AUTH-DEBUG] Token is blacklisted');
      // Clear invalid cookie
      res.clearCookie('token', { path: '/' });
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[AUTH-DEBUG] Token decoded for UserID: ${decoded.id}, Scope: ${decoded.scope || 'None'}`);

    const user = await User.findById(decoded.id);

    if (!user) {
      console.warn(`[AUTH-DEBUG] User not found in DB for ID: ${decoded.id}`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    if (!user.isActive) {
      console.warn(`[AUTH-DEBUG] User account is inactive: ${user.email}`);
      return res.status(401).json({ error: 'Authentication failed' });
    }

    console.log(`[AUTH-DEBUG] User found: ${user.email}, Role: ${user.role}, 2FA: ${user.twoFactorEnabled}`);

    req.user = user;

    // SECURITY: If this is a scoped onboarding token, only allow onboarding routes
    if (decoded.scope) {
      const allowedPaths = {
        'change_password': ['/api/auth/force-change-password'],
        'setup_2fa': ['/api/auth/2fa/setup', '/api/auth/2fa/verify-setup'],
        'mfa_verification': ['/api/auth/verify-mfa'],
        'verify_email': ['/api/auth/verify-email', '/api/auth/resend-otp']
      };

      // ALWAYS allow profile access and logout for scoped tokens
      // Users must be able to logout regardless of onboarding state
      const allowed = [...(allowedPaths[decoded.scope] || []), '/api/auth/profile', '/api/auth/logout'];
      
      // Get current path and normalize it (remove query string and trailing slash)
      let currentPath = req.originalUrl.split('?')[0];
      if (currentPath.endsWith('/') && currentPath !== '/') {
        currentPath = currentPath.slice(0, -1);
      }
      
      // Check if current path is in allowed routes
      const isAllowed = allowed.includes(currentPath);

      if (!isAllowed) {
        console.warn(`[AUTH-DEBUG] Blocked scoped token (${decoded.scope}) from path: ${currentPath}. Allowed: ${JSON.stringify(allowed)}`);
        return res.status(403).json({
          error: 'Account setup required',
          onboardingRequired: true,
          scope: decoded.scope
        });
      }
    }

    // SECURITY: Block non-onboarding routes if onboarding is incomplete
    // ENHANCEMENT: Also catch admins who bypassed the DB flag manually
    const adminNeedsSetup = user.role === 'administrator' && !user.twoFactorEnabled;

    if (!decoded.scope && (user.mustChangePassword || user.mustSetup2FA || !user.isVerified || adminNeedsSetup)) {
      const onboardingRoutes = [
        '/api/auth/force-change-password',
        '/api/auth/2fa/setup',
        '/api/auth/2fa/verify-setup',
        '/api/auth/verify-email',
        '/api/auth/resend-otp',
        '/api/auth/resend-login-otp',
        '/api/auth/verify-otp', // standard login otp
        '/api/auth/logout',
        '/api/auth/profile' // Allow fetching profile to see what's needed
      ];

      // Get current path and normalize it (remove query string and trailing slash)
      let currentPath = req.originalUrl.split('?')[0];
      if (currentPath.endsWith('/') && currentPath !== '/') {
        currentPath = currentPath.slice(0, -1);
      }

      // Check if current path is in allowed routes
      const isAllowed = onboardingRoutes.includes(currentPath);

      if (!isAllowed) {
        console.warn(`[AUTH-DEBUG] Onboarding: Blocked path "${currentPath}" for user ${user.email}. Needs: pwd=${user.mustChangePassword}, 2fa=${user.mustSetup2FA}, verified=${user.isVerified}`);
        return res.status(403).json({
          error: 'Account setup required',
          onboardingRequired: true,
          mustChangePassword: user.mustChangePassword,
          mustSetup2FA: user.mustSetup2FA
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired' });
    }
    res.status(401).json({ error: 'Authentication failed' });
  }
};