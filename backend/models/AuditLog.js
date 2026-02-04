const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // May be null for failed logins or public actions if we decide to log those
    },
    action: {
        type: String,
        required: true,
        description: 'Human readable description of the action'
    },
    details: {
        type: String,
        required: true,
        description: 'Technical details (Method + Endpoint)'
    },
    ip: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'auditLog' // Explicitly naming the collection as requested
});

module.exports = mongoose.model('AuditLog', AuditLogSchema);
