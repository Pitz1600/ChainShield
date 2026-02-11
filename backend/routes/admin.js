const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { strictLimiter } = require('../middleware/rateLimiter');
const { validateAdminCreation, validateEmail } = require('../middleware/validators');
const auditLogger = require('../middleware/auditLogger');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// User Management
router.get('/users', adminController.getAllUsers);
router.post('/users/invite', strictLimiter, validateAdminCreation, auditLogger('admin_invite', req => ({ email: req.body.email })), adminController.inviteAdmin);
router.put('/users/:userId/role', auditLogger('admin_update_user_role'), adminController.updateUserRole);
router.put('/users/:userId/deactivate', auditLogger('admin_deactivate_user'), adminController.deactivateUser);
router.put('/users/:userId/activate', auditLogger('admin_activate_user'), adminController.activateUser);
router.put('/users/:userId', auditLogger('admin_update_user'), adminController.updateUser);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// System Statistics
router.get('/stats', adminController.getSystemStats);

module.exports = router;
