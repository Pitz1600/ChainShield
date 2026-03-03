const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    pendingEditContent: {
        type: String,
        default: null
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
    content: {
        type: String,
        required: true
    },
    pendingEditContent: {
        type: String,
        default: null
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
