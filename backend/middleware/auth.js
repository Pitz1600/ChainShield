const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // SECURITY: Check if token has been blacklisted (logout)
    const { tokenBlacklist } = require('../controllers/authController');
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({ error: 'Authentication failed' });
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
      if (!allowed.includes(req.originalUrl.split('?')[0])) {
        return res.status(403).json({
          error: 'Access denied',
          onboardingRequired: true,
          mustChangePassword: user.mustChangePassword,
          mustSetup2FA: user.mustSetup2FA
        });
      }
    }

    // SECURITY: Block non-onboarding routes if onboarding is incomplete
    if (!decoded.scope && (user.mustChangePassword || user.mustSetup2FA)) {
      const onboardingRoutes = [
        '/api/auth/force-change-password',
        '/api/auth/2fa/setup',
        '/api/auth/2fa/verify-setup',
        '/api/auth/logout'
      ];

      if (!onboardingRoutes.includes(req.originalUrl.split('?')[0])) {
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
    res.status(401).json({ error: 'Authentication failed' });
  }
};