const Feedback = require('../models/Feedback');
const Transaction = require('../models/Transaction');
const { checkAkismet, getStatus } = require('../services/akismetService');

const MAX_FEEDBACK_LENGTH = 1000;
const MIN_FEEDBACK_LENGTH = 10;

const normalizeForSignals = (text) =>
    String(text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

const countWords = (text) => (normalizeForSignals(text).match(/\b\w+\b/g) || []).length;

const getSpamSignals = (text) => {
    const normalized = normalizeForSignals(text);
    const words = normalized.split(/\s+/).filter(Boolean);
    const wordCount = countWords(text);
    const uniqueWords = new Set(words);
    const uniqueRatio = words.length ? uniqueWords.size / words.length : 0;
    const uniqueCharRatio = normalized.length
        ? (new Set(normalized.replace(/\s+/g, '').split('')).size / normalized.replace(/\s+/g, '').length)
        : 1;
    const longestToken = words.reduce((max, w) => Math.max(max, w.length), 0);
    const hasWhitespace = /\s/.test(normalized);
    const urlCount = (text.match(/https?:\/\/|www\./gi) || []).length;
    const repeatedChar = /(.)\1{6,}/.test(normalized);
    const nonAlphaRatio = normalized.length
        ? (normalized.replace(/[a-z0-9\s]/gi, '').length / normalized.length)
        : 0;
    const wordFrequency = words.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
    }, {});
    const maxWordFrequency = Object.values(wordFrequency).reduce((max, count) => Math.max(max, count), 0);
    const maxWordRatio = words.length ? maxWordFrequency / words.length : 0;

    const reasons = [];
    if (normalized.length < MIN_FEEDBACK_LENGTH) reasons.push('too_short');
    if (wordCount > 6 && uniqueRatio < 0.4) reasons.push('low_variance');
    if (urlCount >= 2) reasons.push('too_many_links');
    if (repeatedChar) reasons.push('repeated_chars');
    if (nonAlphaRatio > 0.45) reasons.push('symbol_heavy');
    if (!hasWhitespace && normalized.length >= 40 && longestToken >= 40) reasons.push('long_unbroken_token');
    if (normalized.length >= 40 && uniqueCharRatio < 0.2) reasons.push('low_char_diversity');
    if (wordCount >= 5 && maxWordRatio >= 0.5) reasons.push('repeated_word');

    return { reasons, score: reasons.length, wordCount, urlCount };
};
const MAX_REPLY_LENGTH = 300;

const normalizeContent = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeLegacyPendingApproval = (feedback) => {
    if (!feedback) return;
    if (feedback.actionStatus === 'pending_approval') {
        feedback.actionStatus = 'none';
    }
    if (Array.isArray(feedback.replies)) {
        feedback.replies.forEach((reply) => {
            if (reply.actionStatus === 'pending_approval') {
                reply.actionStatus = 'none';
                reply.pendingEditContent = null;
            }
        });
    }
};

const isHeuristicSpam = (spamCheck) =>
    spamCheck.reasons.includes('too_many_links') || spamCheck.score >= 2;

const isLocalOverrideSpam = (spamCheck) =>
    spamCheck.reasons.includes('too_many_links') ||
    spamCheck.reasons.includes('long_unbroken_token') ||
    spamCheck.reasons.includes('repeated_word');

const evaluateSpam = async ({ content, user, req, commentType }) => {
    const spamCheck = getSpamSignals(content);
    const akismetResult = await checkAkismet({
        content,
        user,
        req,
        commentType,
        permalink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/feedback`
    });
    const localSpam = isHeuristicSpam(spamCheck);
    const localOverride = isLocalOverrideSpam(spamCheck);
    const shouldBlock =
        localOverride ||
        (akismetResult.enabled && akismetResult.valid
            ? akismetResult.isSpam
            : localSpam);
    return { spamCheck, akismetResult, shouldBlock };
};

// @desc    Get all feedbacks
// @route   GET /api/feedbacks
// @access  Public or Authenticated (assuming authenticated for now)
exports.getAllFeedbacks = async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        // Filter by status (approved/pending edits or deletions)
        if (status === 'pending') {
            query.actionStatus = { $in: ['pending_edit', 'pending_delete'] };

            // If not admin/official, they can only see their own pending actions
            if (req.user && req.user.role === 'resident') {
                query.author = req.user._id;
            }
        } else {
            // Default to approved only (status 'none')
            // HOWEVER, we also want authors to see their own pending actions in the main feed
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

        const { content, transactionId, transactionRef } = req.body;
        const normalizedContent = normalizeContent(content);
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_FEEDBACK_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` });
        }

        let tx = null;
        if (transactionId || transactionRef) {
            tx = transactionId
                ? await Transaction.findOne({ transactionId })
                : await Transaction.findById(transactionRef);

            if (!tx) {
                return res.status(400).json({ error: 'Transaction not found for feedback.' });
            }
        }

        const { spamCheck, akismetResult, shouldBlock } = await evaluateSpam({
            content: normalizedContent,
            user: req.user,
            req,
            commentType: 'feedback'
        });
        if (shouldBlock) {
            return res.status(400).json({ error: 'Feedback looks like spam or nonsense. Please add more clear details.' });
        }
        if (process.env.AKISMET_DEBUG === 'true') {
            console.log('[Akismet] feedback/create', {
                enabled: akismetResult.enabled,
                valid: akismetResult.valid,
                isSpam: akismetResult.isSpam,
                error: akismetResult.error,
                urlCount: spamCheck.urlCount
            });
        }
        const isAutoApproved =
            req.user.role === 'barangay_official'
            || req.user.role === 'resident';

        const feedback = await Feedback.create({
            author: req.user._id,
            content: normalizedContent,
            actionStatus: 'none',
            ...(tx ? {
                transactionRef: tx._id,
                transactionMeta: {
                    transactionId: tx.transactionId,
                    amount: tx.amount,
                    agency: tx.agency,
                    programName: tx.programName,
                    transactionType: tx.transactionType,
                    timestamp: tx.timestamp
                }
            } : {})
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
            details: {
                type: 'post',
                content: normalizedContent.substring(0, 100),
                spamSignals: spamCheck.reasons,
                akismet: akismetResult,
                ...(tx ? { transactionId: tx.transactionId } : {})
            },
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
        if (['pending_edit', 'pending_delete'].includes(feedback.actionStatus)) {
            return res.status(400).json({ error: 'Cannot edit a post while a moderation action is pending.' });
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
        // Edits apply immediately for residents/officials; spam check already applied on create.
        if (!normalizedContent) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (normalizedContent.length > MAX_FEEDBACK_LENGTH) {
            return res.status(400).json({ error: `Content must be ${MAX_FEEDBACK_LENGTH} characters or fewer.` });
        }

        if (normalizedContent && normalizedContent !== feedback.content) {
            const { spamCheck, akismetResult, shouldBlock } = await evaluateSpam({
                content: normalizedContent,
                user: req.user,
                req,
                commentType: 'feedback'
            });
            if (shouldBlock) {
                return res.status(400).json({ error: 'Feedback looks like spam or nonsense. Please add more clear details.' });
            }
            if (process.env.AKISMET_DEBUG === 'true') {
                console.log('[Akismet] feedback/update', {
                    enabled: akismetResult.enabled,
                    valid: akismetResult.valid,
                    isSpam: akismetResult.isSpam,
                    error: akismetResult.error,
                    urlCount: spamCheck.urlCount
                });
            }
            feedback.content = normalizedContent;
            feedback.pendingEditContent = null;
            feedback.actionStatus = 'none';
        }

        normalizeLegacyPendingApproval(feedback);
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
        const { spamCheck, akismetResult, shouldBlock } = await evaluateSpam({
            content: normalizedContent,
            user: req.user,
            req,
            commentType: 'reply'
        });
        if (shouldBlock) {
            return res.status(400).json({ error: 'Reply looks like spam or nonsense. Please add more clear details.' });
        }
        if (process.env.AKISMET_DEBUG === 'true') {
            console.log('[Akismet] reply/create', {
                enabled: akismetResult.enabled,
                valid: akismetResult.valid,
                isSpam: akismetResult.isSpam,
                error: akismetResult.error,
                urlCount: spamCheck.urlCount
            });
        }

        const feedback = await Feedback.findById(req.params.id);

        if (!feedback) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        const newReply = {
            author: req.user._id,
            content: normalizedContent,
            actionStatus: 'none' // Auto-approved
        };

        normalizeLegacyPendingApproval(feedback);
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
            details: { type: 'reply', content: normalizedContent.substring(0, 100), akismet: akismetResult },
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
        if (['pending_edit', 'pending_delete'].includes(reply.actionStatus)) {
            return res.status(400).json({ error: 'Cannot edit a reply while a moderation action is pending.' });
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
            const { spamCheck, akismetResult, shouldBlock } = await evaluateSpam({
                content: normalizedContent,
                user: req.user,
                req,
                commentType: 'reply'
            });
            if (shouldBlock) {
                return res.status(400).json({ error: 'Reply looks like spam or nonsense. Please add more clear details.' });
            }
            if (process.env.AKISMET_DEBUG === 'true') {
                console.log('[Akismet] reply/update', {
                    enabled: akismetResult.enabled,
                    valid: akismetResult.valid,
                    isSpam: akismetResult.isSpam,
                    error: akismetResult.error,
                    urlCount: spamCheck.urlCount
                });
            }
            reply.content = normalizedContent;
            reply.pendingEditContent = null;
            reply.actionStatus = 'none';
        }

        normalizeLegacyPendingApproval(feedback);
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
        } else if (feedback.actionStatus === 'pending_edit' && feedback.pendingEditContent) {
            const oldContent = feedback.content;
            feedback.content = feedback.pendingEditContent;
            feedback.actionStatus = 'none';
            feedback.pendingEditContent = null;
            normalizeLegacyPendingApproval(feedback);
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

        if (feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') {
            feedback.actionStatus = 'rejected';
            feedback.pendingEditContent = null;
            normalizeLegacyPendingApproval(feedback);
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
            normalizeLegacyPendingApproval(feedback);
            await feedback.save();
        } else if (reply.actionStatus === 'pending_edit' && reply.pendingEditContent) {
            reply.content = reply.pendingEditContent;
            reply.actionStatus = 'none';
            reply.pendingEditContent = null;
            normalizeLegacyPendingApproval(feedback);
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

        if (reply.actionStatus === 'pending_edit' || reply.actionStatus === 'pending_delete') {
            reply.actionStatus = 'rejected';
            reply.pendingEditContent = null;
            normalizeLegacyPendingApproval(feedback);
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
        normalizeLegacyPendingApproval(feedback);
        await feedback.save();
        return res.status(200).json({ message: 'Deletion requested', feedback });
    } catch (error) {
        console.error('Error deleting reply:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Get Akismet status
// @route   GET /api/feedbacks/akismet-status
// @access  Private (Admin/Official)
exports.getAkismetStatus = async (req, res) => {
    try {
        const status = await getStatus();
        res.status(200).json(status);
    } catch (error) {
        console.error('Error fetching Akismet status:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Cleanup existing spam feedbacks/replies
// @route   POST /api/feedbacks/cleanup-spam
// @access  Private (Admin/Official)
exports.cleanupSpam = async (req, res) => {
    try {
        if (!['administrator', 'barangay_official'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { dryRun = false } = req.body || {};

        const feedbacks = await Feedback.find({})
            .populate('author', 'firstName lastName email role');

        let deletedFeedbacks = 0;
        let removedReplies = 0;
        let heuristicHits = 0;
        let akismetHits = 0;

        for (const feedback of feedbacks) {
            const content = normalizeContent(feedback.content);
            const spamCheck = getSpamSignals(content);
            const heuristicSpam = isHeuristicSpam(spamCheck);
            if (heuristicSpam) heuristicHits += 1;

            const akismetResult = await checkAkismet({
                content,
                user: feedback.author,
                req,
                commentType: 'feedback',
                permalink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/feedback`
            });
            const akismetSpam = akismetResult.enabled && akismetResult.valid && akismetResult.isSpam;
            if (akismetSpam) akismetHits += 1;

            if (heuristicSpam || akismetSpam) {
                if (!dryRun) {
                    await feedback.deleteOne();
                }
                deletedFeedbacks += 1;
                continue;
            }

            if (feedback.replies && feedback.replies.length) {
                const keptReplies = [];
                for (const reply of feedback.replies) {
                    const replyContent = normalizeContent(reply.content);
                    const replySpamCheck = getSpamSignals(replyContent);
                    const replyHeuristicSpam = isHeuristicSpam(replySpamCheck);
                    if (replyHeuristicSpam) heuristicHits += 1;

                    const replyAkismet = await checkAkismet({
                        content: replyContent,
                        user: feedback.author,
                        req,
                        commentType: 'reply',
                        permalink: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/feedback`
                    });
                    const replyAkismetSpam = replyAkismet.enabled && replyAkismet.valid && replyAkismet.isSpam;
                    if (replyAkismetSpam) akismetHits += 1;

                    if (replyHeuristicSpam || replyAkismetSpam) {
                        removedReplies += 1;
                    } else {
                        keptReplies.push(reply);
                    }
                }
                if (!dryRun) {
                    feedback.replies = keptReplies;
                    await feedback.save();
                }
            }
        }

        res.status(200).json({
            dryRun: Boolean(dryRun),
            deletedFeedbacks,
            removedReplies,
            heuristicHits,
            akismetHits
        });
    } catch (error) {
        console.error('Error cleaning spam feedbacks:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};

// @desc    Test spam detection (heuristics + Akismet)
// @route   POST /api/feedbacks/spam-test
// @access  Private (Admin/Official)
exports.spamTest = async (req, res) => {
    try {
        if (!['administrator', 'barangay_official'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const { content = '', type = 'feedback' } = req.body || {};
        const normalized = normalizeContent(content);
        if (!normalized) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const { spamCheck, akismetResult, shouldBlock } = await evaluateSpam({
            content: normalized,
            user: req.user,
            req,
            commentType: type === 'reply' ? 'reply' : 'feedback'
        });

        res.status(200).json({
            heuristic: {
                isSpam: isHeuristicSpam(spamCheck),
                reasons: spamCheck.reasons,
                score: spamCheck.score,
                urlCount: spamCheck.urlCount
            },
            akismet: akismetResult,
            decision: { shouldBlock }
        });
    } catch (error) {
        console.error('Error running spam test:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};
