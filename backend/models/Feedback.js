const mongoose = require('mongoose');

const MAX_FEEDBACK_LENGTH = 1000;
const MAX_REPLY_LENGTH = 300;

const replySchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: MAX_REPLY_LENGTH
    },
    pendingEditContent: {
        type: String,
        default: null,
        maxlength: MAX_REPLY_LENGTH
    },
    actionStatus: {
        type: String,
        enum: ['none', 'pending_approval', 'pending_edit', 'pending_delete', 'rejected'],
        default: 'none'
    }
}, {
    timestamps: true
});

const feedbackSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transactionRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },
    transactionMeta: {
        transactionId: { type: String },
        amount: { type: Number },
        agency: { type: String },
        programName: { type: String },
        transactionType: { type: String },
        timestamp: { type: Date }
    },
    content: {
        type: String,
        required: true,
        maxlength: MAX_FEEDBACK_LENGTH
    },
    pendingEditContent: {
        type: String,
        default: null,
        maxlength: MAX_FEEDBACK_LENGTH
    },
    actionStatus: {
        type: String,
        enum: ['none', 'pending_approval', 'pending_edit', 'pending_delete', 'rejected'],
        default: 'pending_approval'
    },
    replies: [replySchema]
}, {
    timestamps: true
});

module.exports = mongoose.model('Feedback', feedbackSchema);
