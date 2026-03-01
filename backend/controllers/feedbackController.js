const Feedback = require('../models/Feedback');
const xss = require('xss');
const AuditLog = require('../models/AuditLog');

// Get all feedback messages
exports.getAllFeedback = async (req, res) => {
    try {
        const { search, limit = 50, skip = 0 } = req.query;
        
        let query = {};
        
        // Add search filter if provided
        if (search && search.trim()) {
            query = {
                $or: [
                    { message: { $regex: search, $options: 'i' } },
                    { userName: { $regex: search, $options: 'i' } },
                    { 'replies.message': { $regex: search, $options: 'i' } }
                ]
            };
        }

        const feedbacks = await Feedback.find(query)
            .sort({ updatedAt: -1 }) // Most recently updated first
            .limit(parseInt(limit))
            .skip(parseInt(skip))
            .lean();

        const total = await Feedback.countDocuments(query);

        res.json({
            success: true,
            data: feedbacks,
            total,
            hasMore: total > parseInt(skip) + feedbacks.length
        });
    } catch (error) {
        console.error('Error fetching feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch feedback'
        });
    }
};

// Create a new feedback message
exports.createFeedback = async (req, res) => {
    try {
        const { message } = req.body;

        // Validation
        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Message is required'
            });
        }

        if (message.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Message must be less than 2000 characters'
            });
        }

        // Sanitize message
        const sanitizedMessage = xss(message.trim());

        // Get user info from token
        const userId = req.user.userId;
        const userName = req.user.fullName || req.user.email;
        const userRole = req.user.role;

        const feedback = new Feedback({
            userId,
            userName,
            userRole,
            message: sanitizedMessage
        });

        await feedback.save();

        // Log the action
        await AuditLog.create({
            userId,
            action: 'CREATE_FEEDBACK',
            details: { feedbackId: feedback._id },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            success: true,
            message: 'Feedback posted successfully',
            data: feedback
        });
    } catch (error) {
        console.error('Error creating feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to post feedback'
        });
    }
};

// Add a reply to a feedback message
exports.addReply = async (req, res) => {
    try {
        const { feedbackId } = req.params;
        const { message } = req.body;

        // Validation
        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Reply message is required'
            });
        }

        if (message.length > 2000) {
            return res.status(400).json({
                success: false,
                message: 'Reply must be less than 2000 characters'
            });
        }

        // Sanitize message
        const sanitizedMessage = xss(message.trim());

        // Find the feedback
        const feedback = await Feedback.findById(feedbackId);
        
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        // Get user info from token
        const userId = req.user.userId;
        const userName = req.user.fullName || req.user.email;
        const userRole = req.user.role;

        // Add reply
        feedback.replies.push({
            userId,
            userName,
            userRole,
            message: sanitizedMessage
        });

        await feedback.save();

        // Log the action
        await AuditLog.create({
            userId,
            action: 'ADD_FEEDBACK_REPLY',
            details: { feedbackId: feedback._id },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Reply added successfully',
            data: feedback
        });
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add reply'
        });
    }
};

// Delete a feedback message (admin only)
exports.deleteFeedback = async (req, res) => {
    try {
        const { feedbackId } = req.params;

        const feedback = await Feedback.findById(feedbackId);
        
        if (!feedback) {
            return res.status(404).json({
                success: false,
                message: 'Feedback not found'
            });
        }

        // Allow deletion only if user is admin or the author
        if (req.user.role !== 'administrator' && feedback.userId.toString() !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this feedback'
            });
        }

        await Feedback.findByIdAndDelete(feedbackId);

        // Log the action
        await AuditLog.create({
            userId: req.user.userId,
            action: 'DELETE_FEEDBACK',
            details: { feedbackId },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'Feedback deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete feedback'
        });
    }
};
