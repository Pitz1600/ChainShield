const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const feedbackController = require('../controllers/feedbackController');
const { body } = require('express-validator');

// Validation middleware
const validateFeedback = [
    body('message')
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ max: 2000 })
        .withMessage('Message must be less than 2000 characters')
];

// Get all feedback messages
router.get('/', auth, feedbackController.getAllFeedback);

// Create a new feedback message
router.post('/', auth, validateFeedback, feedbackController.createFeedback);

// Add a reply to a feedback message
router.post('/:feedbackId/reply', auth, validateFeedback, feedbackController.addReply);

// Delete a feedback message (admin or author only)
router.delete('/:feedbackId', auth, feedbackController.deleteFeedback);

module.exports = router;
