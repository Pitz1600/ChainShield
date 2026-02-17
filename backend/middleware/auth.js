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
      // Clear invalid cookie
      res.clearCookie('token');
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // SECURITY: If this is a scoped onboarding token, only allow onboarding routes
    if (decoded.scope) {
      const allowedPaths = {
        'change_password': ['/api/auth/force-change-password'],
        'setup_2fa': ['/api/auth/2fa/setup', '/api/auth/2fa/verify-setup']
      };

      const allowed = allowedPaths[decoded.scope] || [];
      // Simple path check - in production might need robust matching
      const currentPath = req.originalUrl.split('?')[0];

      if (!allowed.includes(currentPath)) {
        return res.status(403).json({
          error: 'Access denied',
          onboardingRequired: true,
          mustChangePassword: user.mustChangePassword,
          mustSetup2FA: user.mustSetup2FA
        });
      }
    }

    // SECURITY: Block non-onboarding routes if onboarding is incomplete
    if (!decoded.scope && (user.mustChangePassword || user.mustSetup2FA || !user.isVerified)) {
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

      const currentPath = req.originalUrl.split('?')[0];

      if (!onboardingRoutes.includes(currentPath)) {
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