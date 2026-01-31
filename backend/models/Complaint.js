const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null // null if anonymous
    },
    userEmail: {
        type: String,
        default: null
    },
    trackingNumber: {
        type: String,
        unique: true
    },
    category: {
        type: String,
        required: true,
        enum: [
            'Infrastructure',
            'Public Services',
            'Health & Sanitation',
            'Peace & Order',
            'Environmental',
            'Corruption/Irregularity',
            'Other'
        ]
    },
    subject: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    location: {
        type: String,
        default: ''
    },
    anonymous: {
        type: Boolean,
        default: false
    },
    attachments: [{
        type: String // file paths
    }],
    status: {
        type: String,
        enum: ['pending', 'under_review', 'in_progress', 'resolved', 'closed'],
        default: 'pending'
    },
    response: {
        type: String,
        default: ''
    },
    respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    respondedAt: {
        type: Date
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Generate tracking number before saving
complaintSchema.pre('save', async function (next) {
    if (!this.trackingNumber) {
        const count = await mongoose.model('Complaint').countDocuments();
        this.trackingNumber = `CMP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Complaint', complaintSchema);
