const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const Complaint = require('../models/Complaint');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/complaints/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and PDF files are allowed'));
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

const { body, validationResult } = require('express-validator');
const xss = require('xss');

// Validation rules for complaint submission
const validateComplaint = [
    body('category')
        .isIn([
            'Infrastructure',
            'Public Services',
            'Health & Sanitation',
            'Peace & Order',
            'Environmental',
            'Corruption/Irregularity',
            'Other'
        ])
        .withMessage('Invalid category'),
    body('subject')
        .trim()
        .notEmpty()
        .withMessage('Subject is required')
        .isLength({ max: 200 })
        .withMessage('Subject must be less than 200 characters'),
    body('description')
        .trim()
        .notEmpty()
        .withMessage('Description is required')
];

// Submit a new complaint
router.post('/', auth, upload.array('attachments', 5), validateComplaint, async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { category, subject, description, location, anonymous } = req.body;

        // XSS Sanitization
        const sanitizedSubject = xss(subject);
        const sanitizedDescription = xss(description);
        const sanitizedLocation = location ? xss(location) : '';

        // Get file paths
        const attachments = req.files ? req.files.map(file => file.path) : [];

        const complaint = new Complaint({
            userId: anonymous === 'true' ? null : req.user.userId,
            userEmail: anonymous === 'true' ? null : req.user.email,
            category,
            subject: sanitizedSubject,
            description: sanitizedDescription,
            location: sanitizedLocation,
            anonymous: anonymous === 'true',
            attachments,
            status: 'pending',
            submittedAt: new Date()
        });

        await complaint.save();

        res.status(201).json({
            success: true,
            message: 'Complaint submitted successfully',
            complaintId: complaint._id,
            trackingNumber: complaint.trackingNumber
        });
    } catch (error) {
        console.error('Submit complaint error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get current user's complaints
router.get('/my-complaints', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, status } = req.query;

        const query = {
            $or: [
                { userId: req.user.userId },
                { userEmail: req.user.email }
            ]
        };

        if (status && status !== 'all') {
            query.status = status;
        }

        const complaints = await Complaint.find(query)
            .sort({ submittedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .select('-attachments'); // Don't send file paths to frontend

        const count = await Complaint.countDocuments(query);

        res.json({
            success: true,
            complaints,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            count
        });
    } catch (error) {
        console.error('Get my complaints error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all complaints (officials/admins only)
router.get('/', auth, async (req, res) => {
    try {
        // Check if user is official or admin
        const allowedRoles = ['barangay_official', 'administrator', 'analyst', 'investigator'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { page = 1, limit = 20, status, category } = req.query;

        const query = {};
        if (status && status !== 'all') query.status = status;
        if (category && category !== 'all') query.category = category;

        const complaints = await Complaint.find(query)
            .sort({ submittedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const count = await Complaint.countDocuments(query);

        res.json({
            success: true,
            complaints,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            count
        });
    } catch (error) {
        console.error('Get complaints error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update complaint status (officials/admins only)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const allowedRoles = ['barangay_official', 'administrator'];
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { status, response } = req.body;

        const complaint = await Complaint.findByIdAndUpdate(
            req.params.id,
            {
                status,
                response,
                respondedBy: req.user.userId,
                respondedAt: new Date()
            },
            { new: true }
        );

        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        res.json({
            success: true,
            complaint
        });
    } catch (error) {
        console.error('Update complaint error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
