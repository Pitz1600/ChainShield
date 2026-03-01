const Feedback = require('../models/Feedback');

// @desc    Get all feedbacks
// @route   GET /api/feedbacks
// @access  Public or Authenticated (assuming authenticated for now)
exports.getAllFeedbacks = async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            const searchRegex = new RegExp(search, 'i');

            // To search by author name, we need to populate first, but mongoose doesn't support regex on populated fields directly in find().
            // We'll use aggregate or a two-step process. A simpler way is to find users matching the name, then find feedbacks by those users or matching content.
            const User = require('../models/User');
            const matchingUsers = await User.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex }
                ]
            }).select('_id');
            const userIds = matchingUsers.map(u => u._id);

            query = {
                $or: [
                    { content: searchRegex },
                    { author: { $in: userIds } },
                    { 'replies.content': searchRegex }
                ]
            };
        }

        const feedbacks = await Feedback.find(query)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role')
            .sort({ createdAt: -1 }); // Newest to oldest (latest on top)

        res.status(200).json(feedbacks);
    } catch (error) {
        console.error('Error fetching feedbacks:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Create a new feedback
// @route   POST /api/feedbacks
// @access  Private (Resident, Official, Admin)
exports.createFeedback = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const feedback = await Feedback.create({
            author: req.user._id,
            content
        });

        const populatedFeedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role');

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
        let feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        // Check ownership or role
        const isAuthor = feedback.author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'administrator';
        const isOfficial = req.user.role === 'barangay_official';

        if (!isAuthor && !isAdmin && !isOfficial) {
            return res.status(403).json({ error: 'Not authorized to update this feedback' });
        }

        if (isAdmin) {
            // Admins can update immediately
            feedback.content = content || feedback.content;
            feedback.actionStatus = 'none';
            feedback.pendingEditContent = null;
        } else {
            // Residents and Officials queue the edit
            if (content && content !== feedback.content) {
                feedback.pendingEditContent = content;
                feedback.actionStatus = 'pending_edit';
            }
        }

        await feedback.save();

        feedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

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

        // Check ownership or role
        const isAuthor = feedback.author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'administrator';
        const isOfficial = req.user.role === 'barangay_official';

        if (!isAuthor && !isAdmin && !isOfficial) {
            return res.status(403).json({ error: 'Not authorized to delete this feedback' });
        }

        if (isAdmin) {
            await feedback.deleteOne();
            return res.status(200).json({ message: 'Feedback removed' });
        } else {
            // Residents and Officials queue the deletion
            feedback.actionStatus = 'pending_delete';
            await feedback.save();

            const updatedFeedback = await Feedback.findById(feedback._id)
                .populate('author', 'firstName lastName email role')
                .populate('replies.author', 'firstName lastName email role');

            return res.status(200).json({ message: 'Deletion pending admin approval', feedback: updatedFeedback });
        }
    } catch (error) {
        console.error('Error deleting feedback:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Add a reply to a feedback
// @route   POST /api/feedbacks/:id/replies
// @access  Private (Resident, Official, Admin)
exports.addReply = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const newReply = {
            author: req.user._id,
            content
        };

        feedback.replies.push(newReply);
        await feedback.save();

        const updatedFeedback = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

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
        let feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        // Check ownership or role
        const isAuthor = reply.author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'administrator';
        const isOfficial = req.user.role === 'barangay_official';

        if (!isAuthor && !isAdmin && !isOfficial) {
            return res.status(403).json({ error: 'Not authorized to update this reply' });
        }

        if (isAdmin) {
            // Admins can update immediately
            reply.content = content || reply.content;
            reply.actionStatus = 'none';
            reply.pendingEditContent = null;
        } else {
            // Residents and Officials queue the edit
            if (content && content !== reply.content) {
                reply.pendingEditContent = content;
                reply.actionStatus = 'pending_edit';
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
        const feedback = await Feedback.findById(req.params.id);
        if (!feedback) return res.status(404).json({ error: 'Feedback not found' });

        if (req.user.role !== 'administrator') {
            return res.status(403).json({ error: 'Not authorized to approve actions' });
        }

        if (feedback.actionStatus === 'pending_delete') {
            await feedback.deleteOne();
            return res.status(200).json({ message: 'Feedback removed' });
        } else if (feedback.actionStatus === 'pending_edit' && feedback.pendingEditContent) {
            feedback.content = feedback.pendingEditContent;
            feedback.actionStatus = 'none';
            feedback.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

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

        if (req.user.role !== 'administrator') {
            return res.status(403).json({ error: 'Not authorized to reject actions' });
        }

        if (feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') {
            feedback.actionStatus = 'rejected';
            feedback.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

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

        if (req.user.role !== 'administrator') {
            return res.status(403).json({ error: 'Not authorized to approve actions' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ error: 'Reply not found' });

        if (reply.actionStatus === 'pending_delete') {
            feedback.replies.pull(req.params.replyId);
            await feedback.save();
        } else if (reply.actionStatus === 'pending_edit' && reply.pendingEditContent) {
            reply.content = reply.pendingEditContent;
            reply.actionStatus = 'none';
            reply.pendingEditContent = null;
            await feedback.save();
        }

        const updated = await Feedback.findById(feedback._id)
            .populate('author', 'firstName lastName email role')
            .populate('replies.author', 'firstName lastName email role');

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

        if (req.user.role !== 'administrator') {
            return res.status(403).json({ error: 'Not authorized to reject actions' });
        }

        const reply = feedback.replies.id(req.params.replyId);
        if (!reply) return res.status(404).json({ error: 'Reply not found' });

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

        // Check ownership or role
        const isAuthor = reply.author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'administrator';
        const isOfficial = req.user.role === 'barangay_official';

        if (!isAuthor && !isAdmin && !isOfficial) {
            return res.status(403).json({ error: 'Not authorized to delete this reply' });
        }

        if (isAdmin) {
            feedback.replies.pull(req.params.replyId);
            await feedback.save();
            return res.status(200).json({ message: 'Reply removed' });
        } else {
            // Residents and Officials queue the deletion
            reply.actionStatus = 'pending_delete';
            await feedback.save();

            const updatedFeedback = await Feedback.findById(feedback._id)
                .populate('author', 'firstName lastName email role')
                .populate('replies.author', 'firstName lastName email role');

            return res.status(200).json({ message: 'Reply deletion pending admin approval', feedback: updatedFeedback });
        }
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};
