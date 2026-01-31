const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { strictLimiter } = require('../middleware/rateLimiter');
const { validateAdminCreation, validateEmail } = require('../middleware/validators');

// All admin routes require authentication and admin role
router.use(authMiddleware);
router.use(requireAdmin);

// User Management
router.get('/users', adminController.getAllUsers);
router.post('/users/invite', strictLimiter, validateAdminCreation, adminController.inviteAdmin);
router.put('/users/:userId/role', adminController.updateUserRole);
router.put('/users/:userId/deactivate', adminController.deactivateUser);
router.put('/users/:userId/activate', adminController.activateUser);
router.put('/users/:userId', adminController.updateUser);

// System Statistics
router.get('/stats', adminController.getSystemStats);

module.exports = router;
