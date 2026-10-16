const express = require('express');
const router = express.Router();
const { validateFieldLengths } = require('../middleware/fieldLimits');
router.use(validateFieldLengths);
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { strictLimiter } = require('../middleware/rateLimiter');
const auditLogger = require('../middleware/auditLogger');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// User Management
router.get('/users', adminController.getAllUsers);
router.post('/users', strictLimiter, adminController.requireStepUp, adminController.createUser);
router.put('/users/:userId/role', auditLogger('admin_update_user_role'), adminController.requireStepUp, adminController.updateUserRole);
router.put('/users/:userId/deactivate', auditLogger('admin_deactivate_user'), adminController.deactivateUser);
router.put('/users/:userId/approve', auditLogger('admin_approve_user'), adminController.requireStepUp, adminController.approveUser);
router.put('/users/:userId/activate', auditLogger('admin_activate_user'), adminController.requireStepUp, adminController.activateUser);
router.put('/users/:userId', auditLogger('admin_update_user'), adminController.requireStepUp, adminController.updateUser);
router.delete('/users/:userId', adminController.deleteUser);

// Audit Logs
router.get('/audit-logs', adminController.getAuditLogs);

// System Statistics
router.get('/stats', adminController.getSystemStats);

module.exports = router;
