const Feedback = require('../models/Feedback');

const MAX_FEEDBACK_LENGTH = 1000;
const MAX_REPLY_LENGTH = 300;

const normalizeContent = (value) => (typeof value === 'string' ? value.trim() : '');

// @desc    Get all feedbacks
// @route   GET /api/feedbacks
// @access  Public or Authenticated (assuming authenticated for now)
exports.getAllFeedbacks = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        // Filter by status (approved/pending)
        if (status === 'pending') {
            query.actionStatus = 'pending_approval';

            // If not admin/official, they can only see their own pending posts
            if (req.user && req.user.role === 'resident') {
                query.author = req.user._id;
            }
        } else {
            // Default to approved only (status 'none')
            // HOWEVER, we also want authors to see their own pending posts in the main feed
            if (req.user) {
                query.$or = [
                    { actionStatus: 'none' },
                    { author: req.user._id }
                ];
            } else {
                query.actionStatus = 'none';
            }
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            const User = require('../models/User');
            // ... (rest of search logic remains similar but inside the existing query)
            const matchingUsers = await User.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            const searchFilter = {
                $or: [
                    { content: searchRegex },
                    { author: { $in: userIds } },
                    { 'replies.content': searchRegex }
                ]
            };

            // Merge search filter with status filter
            if (query.$or) {
                // If we have the complex $or for author visibility, we need to be careful
                query = { $and: [query, searchFilter] };
            } else {
                Object.assign(query, searchFilter);
            }
        }

        const feedbacks = await Feedback.find(query)
            .populate('author', 'firstName lastName email role profilePicture position')
            .populate('replies.author', 'firstName lastName email role profilePicture position')
            .sort({ createdAt: -1 }); // Newest to oldest (latest on top)

        res.status(200).json(feedbacks);
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Create a new feedback
// @route   POST /api/feedbacks
// @access  Private (Resident, Barangay Official, Auditor)
exports.createFeedback = async (req, res) => {
    try {
        if (!['resident', 'barangay_official', 'auditor'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Only residents, barangay officials, and auditors can post feedback.' });
        }

        const { content } = req.body;
        const normalizedContent = normalizeContent(content);
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_FEEDBACK_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` });
        }

        const isAutoApproved = req.user.role === 'barangay_official';
        const feedback = await Feedback.create({
            author: req.user._id,
            content: normalizedContent,
            actionStatus: isAutoApproved ? 'none' : 'pending_approval'
        });

        const populatedFeedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role profilePicture position');

        // Log the feedback creation
        const AuditLog = require('../models/AuditLog');
        await AuditLog.logAction({
            action: isAutoApproved ? 'feedback_auto_approved' : 'feedback_submitted',
            userId: req.user._id,
            userRole: req.user.role,
            username: `${req.user.firstName} ${req.user.lastName}`,
            feedbackId: feedback._id,
            details: { type: 'post', content: normalizedContent.substring(0, 100) },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json(populatedFeedback);
    } catch (error) {
        console.error('Error creating feedback:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Update a feedback
// @route   PUT /api/feedbacks/:id
// @access  Private (Author, Official, Admin)
exports.updateFeedback = async (req, res) => {
    try {
        const { content } = req.body;
        const normalizedContent = normalizeContent(content);
        let feedback = await Feedback.findById(req.params.id)
            .populate('author', 'firstName lastName email role profilePicture position')
            .populate('replies.author', 'firstName lastName email role profilePicture position');

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // Prevent editing while any moderation request is pending
        if (['pending_approval', 'pending_edit', 'pending_delete'].includes(feedback.actionStatus)) {
            return res.status(400).json({ error: 'Cannot edit a post that is pending approval. Please delete and repost if necessary.' });
        }

        // Only authors can update their own posts. Admins/Officials are view-only in the public feed.
        if (feedback.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this feedback. Only the author can perform this action.' });
        }

        // Admin cannot post/edit community content; moderation only.
        if (req.user.role === 'administrator') {
            return res.status(403).json({ error: 'Administrators cannot edit posts. Moderation only.' });
        }

        const isAutoApproved = req.user.role === 'barangay_official';
        // Any edit goes back to approval flow unless auto-approved.
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_FEEDBACK_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` });
        }

        if (normalizedContent && normalizedContent !== feedback.content) {
            if (isAutoApproved) {
                feedback.content = normalizedContent;
                feedback.pendingEditContent = null;
                feedback.actionStatus = 'none';
            } else {
                feedback.pendingEditContent = normalizedContent;
                feedback.actionStatus = 'pending_approval';
            }
        }

        await feedback.save();

        feedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role position')
            .populate('replies.author', 'firstName lastName email role position');

        res.status(200).json(feedback);
    } catch (error) {
        console.error('Error updating feedback:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Delete a feedback
// @route   DELETE /api/feedbacks/:id
// @access  Private (Author, Official, Admin)
exports.deleteFeedback = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // If author or admin, delete immediately (skip moderation)
        if (feedback.author.toString() === req.user._id.toString() || req.user.role === 'administrator') {
            await feedback.deleteOne();
            return res.status(200).json({ message: 'Feedback deleted successfully' });
        }

        // Otherwise (though permissions currently limit this to author), queue for deletion
        feedback.actionStatus = 'pending_delete';
        await feedback.save();
        res.status(200).json({ message: 'Deletion requested', feedback });
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Add a reply to a feedback
// @route   POST /api/feedbacks/:id/replies
// @access  Private (Resident, Barangay Official)
exports.addReply = async (req, res) => {
    try {
        // Admin is moderation-only for community feedback.
        if (req.user.role === 'administrator') {
            return res.status(403).json({ error: 'Administrators cannot post replies.' });
        }

        const { content } = req.body;
        const normalizedContent = normalizeContent(content);
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_REPLY_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_REPLY_LENGTH} characters or fewer.` });
        }

        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        if (feedback.actionStatus === 'pending_approval') {
            return res.status(400).json({ error: 'Cannot reply to a post that is pending approval.' });
        }

        const newReply = {
            author: req.user._id,
            content: normalizedContent,
            actionStatus: 'none' // Auto-approved
        };

        feedback.replies.push(newReply);
        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role profilePicture position')
            .populate('replies.author', 'firstName lastName email role profilePicture position');

        // Log the reply action
        const AuditLog = require('../models/AuditLog');
        await AuditLog.logAction({
            action: 'feedback_submitted',
            userId: req.user._id,
            userRole: req.user.role,
            username: `${req.user.firstName} ${req.user.lastName}`,
            feedbackId: feedback._id,
            details: { type: 'reply', content: normalizedContent.substring(0, 100) },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json(updatedFeedback);
    } catch (error) {
        console.error('Error adding reply:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Update a reply
// @route   PUT /api/feedbacks/:id/replies/:replyId
// @access  Private (Reply Author, Official, Admin)
exports.updateReply = async (req, res) => {
    try {
        const { content } = req.body;
        const normalizedContent = normalizeContent(content);
        let feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Prevent editing while any moderation request is pending
        if (['pending_approval', 'pending_edit', 'pending_delete'].includes(reply.actionStatus)) {
            return res.status(400).json({ error: 'Cannot edit a reply that is pending approval.' });
        }

        // Only authors can update their own replies.
        if (reply.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to update this reply. Only the author can perform this action.' });
        }

        // Admin cannot post/edit community content; moderation only.
        if (req.user.role === 'administrator') {
            return res.status(403).json({ error: 'Administrators cannot edit replies. Moderation only.' });
        }

        // Any edit goes back to approval flow.
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_REPLY_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_REPLY_LENGTH} characters or fewer.` });
        }

        if (normalizedContent && normalizedContent !== reply.content) {
            if (req.user.role === 'barangay_official') {
                reply.content = normalizedContent;
                reply.pendingEditContent = null;
                reply.actionStatus = 'none';
            } else {
                reply.pendingEditContent = normalizedContent;
                reply.actionStatus = 'pending_approval';
            }
        }

        await feedback.save();

        feedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

        res.status(200).json(feedback);
    } catch (error) {
        console.error('Error updating reply:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Approve a pending action (edit/delete) on a feedback
// @route   PUT /api/feedbacks/:id/approve
// @access  Private (Admin)
exports.approveAction = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id)
            .populate('author', 'firstName lastName email role profilePicture')
            .populate('replies.author', 'firstName lastName email role profilePicture');
        if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

        if (req.user.role !== 'administrator' && req.user.role !== 'barangay_official') {
            return res.status(403).json({ error: 'Not authorized to perform this action' });
        }

        if (feedback.actionStatus === 'pending_delete') {
            await Feedback.findByIdAndDelete(feedback._id);

            // Log the approval (which results in deletion)
            const AuditLog = require('../models/AuditLog');
            await AuditLog.logAction({
                action: 'feedback_deleted', // Or 'feedback_approved_deletion'
                userId: req.user._id,
                userRole: req.user.role,
                username: `${req.user.firstName} ${req.user.lastName}`,
                feedbackId: feedback._id,
                details: { status: 'pending_delete', content: feedback.content.substring(0, 100) },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
            return res.status(200).json({ message: 'Feedback removed' });
        } else if (feedback.actionStatus === 'pending_approval') {
            const approvalType = feedback.pendingEditContent ? 'edit' : 'post';
            if (feedback.pendingEditContent) {
                feedback.content = feedback.pendingEditContent;
                feedback.pendingEditContent = null;
            }
            feedback.actionStatus = 'none';
            await feedback.save();

            // Log the approval
            const AuditLog = require('../models/AuditLog');
            await AuditLog.logAction({
                action: 'feedback_approved',
                userId: req.user._id,
                userRole: req.user.role,
                username: `${req.user.firstName} ${req.user.lastName}`,
                feedbackId: feedback._id,
                details: {
                    status: 'pending_approval',
                    type: approvalType,
                    content: feedback.content.substring(0, 100)
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        } else if (feedback.actionStatus === 'pending_edit' && feedback.pendingEditContent) {
            const oldContent = feedback.content;
            feedback.content = feedback.pendingEditContent;
            feedback.actionStatus = 'none';
            feedback.pendingEditContent = null;
            await feedback.save();

            // Log the approval
            const AuditLog = require('../models/AuditLog');
            await AuditLog.logAction({
                action: 'feedback_approved',
                userId: req.user._id,
                userRole: req.user.role,
                username: `${req.user.firstName} ${req.user.lastName}`,
                feedbackId: feedback._id,
                details: { status: 'pending_edit', oldContent: oldContent.substring(0, 100), newContent: feedback.content.substring(0, 100) },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role position')
            .populate('replies.author', 'firstName lastName email role position');

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error approving action:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Reject a pending action on a feedback
// @route   PUT /api/feedbacks/:id/reject
// @access  Private (Admin)
exports.rejectAction = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

        if (req.user.role !== 'administrator' && req.user.role !== 'barangay_official') {
            return res.status(403).json({ error: 'Not authorized to perform this action' });
        }

        if (feedback.actionStatus === 'pending_approval') {
            // New posts pending approval are removed on rejection.
            // Edited posts pending approval should keep original content.
            if (feedback.pendingEditContent) {
                feedback.actionStatus = 'none';
                feedback.pendingEditContent = null;
                await feedback.save();
                return res.status(200).json({ message: 'Edited feedback rejected. Original post kept.' });
            }

            await Feedback.findByIdAndDelete(feedback._id);

            // Log the rejection
            const AuditLog = require('../models/AuditLog');
            await AuditLog.logAction({
                action: 'feedback_rejected',
                userId: req.user._id,
                userRole: req.user.role,
                username: `${req.user.firstName} ${req.user.lastName}`,
                feedbackId: feedback._id,
                details: { status: 'pending_approval', content: feedback.content.substring(0, 100) },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            return res.status(200).json({ message: 'Feedback rejected and deleted' });
        }

        if (feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') {
            feedback.actionStatus = 'rejected';
            feedback.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role position')
            .populate('replies.author', 'firstName lastName email role position');

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error rejecting action:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Approve a pending action on a reply
// @route   PUT /api/feedbacks/:id/replies/:replyId/approve
// @access  Private (Admin)
exports.approveReplyAction = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

        if (req.user.role !== 'administrator' && req.user.role !== 'barangay_official') {
            return res.status(403).json({ error: 'Not authorized to perform this action' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ error: 'Reply not found' });

        if (reply.actionStatus === 'pending_delete') {
            feedback.replies.pull(req.params.replyId);
            await feedback.save();
        } else if (reply.actionStatus === 'pending_approval' && reply.pendingEditContent) {
            reply.content = reply.pendingEditContent;
            reply.actionStatus = 'none';
            reply.pendingEditContent = null;
            await feedback.save();
        } else if (reply.actionStatus === 'pending_edit' && reply.pendingEditContent) {
            reply.content = reply.pendingEditContent;
            reply.actionStatus = 'none';
            reply.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role position')
            .populate('replies.author', 'firstName lastName email role position');

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error approving reply action:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Reject a pending action on a reply
// @route   PUT /api/feedbacks/:id/replies/:replyId/reject
// @access  Private (Admin)
exports.rejectReplyAction = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

        if (req.user.role !== 'administrator' && req.user.role !== 'barangay_official') {
            return res.status(403).json({ error: 'Not authorized to perform this action' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ error: 'Reply not found' });

        if (reply.actionStatus === 'pending_approval') {
            // New replies pending approval are removed on rejection.
            // Edited replies pending approval should keep original content.
            if (reply.pendingEditContent) {
                reply.actionStatus = 'none';
                reply.pendingEditContent = null;
                await feedback.save();
                return res.status(200).json({ message: 'Edited reply rejected. Original reply kept.' });
            }

            const content = reply.content;
            feedback.replies.pull(reply._id);
            await feedback.save();

            // Log the rejection
            const AuditLog = require('../models/AuditLog');
            await AuditLog.logAction({
                action: 'feedback_rejected',
                userId: req.user._id,
                userRole: req.user.role,
                username: `${req.user.firstName} ${req.user.lastName}`,
                feedbackId: feedback._id,
                details: { type: 'reply', status: 'pending_approval', content: content.substring(0, 100) },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            return res.status(200).json({ message: 'Reply rejected and deleted' });
        }

        if (reply.actionStatus === 'pending_edit' || reply.actionStatus === 'pending_delete') {
            reply.actionStatus = 'rejected';
            reply.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error rejecting reply action:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Delete a reply
// @route   DELETE /api/feedbacks/:id/replies/:replyId
// @access  Private (Reply Author, Official, Admin)
exports.deleteReply = async (req, res) => {
    try {
        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const reply = feedback.replies.id(req.params.replyId);

        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Only authors can delete their own replies.
        if (reply.author.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized to delete this reply. Only the author can perform this action.' });
        }

        // Residents queue the deletion
        reply.actionStatus = 'pending_delete';
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};
