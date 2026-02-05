const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Submit feedback
router.post('/', feedbackController.submitFeedback);

// Get pending feedback (admin only)
router.get('/pending', feedbackController.getPendingFeedback);

// Approve feedback (admin only)
router.post('/:id/approve', feedbackController.approveFeedback);

// Reject feedback (admin only)
router.post('/:id/reject', feedbackController.rejectFeedback);

// Get feedback statistics
router.get('/stats', feedbackController.getFeedbackStats);

// Get analyst's own feedback
router.get('/my-feedback', feedbackController.getMyFeedback);

// Audit logs (admin only)
router.get('/audit-logs', feedbackController.getAuditLogs);

// Flag feedback as malicious (admin only)
router.post('/:id/flag', feedbackController.flagFeedback);

// Get rate limit status
router.get('/rate-limit-status', feedbackController.getRateLimitStatus);

// Reset user's rate limit (admin only)
router.post('/reset-rate-limit/:userId', feedbackController.resetRateLimit);

module.exports = router;

