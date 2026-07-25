const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csvImportController = require('../controllers/csvImportController');
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/auth');
const { requireOfficial, requireRole } = require('../middleware/roleMiddleware');

const requireVerifier = requireRole(['administrator', 'barangay_official', 'auditor']);

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // SECURITY: Validate both extension AND MIME type
        const allowedExtensions = ['.csv'];
        const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
        const ext = path.extname(file.originalname).toLowerCase();

        if (!allowedExtensions.includes(ext)) {
            return cb(new Error('Only CSV files are allowed'));
        }
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only CSV files are accepted.'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// CSV Import routes - requires barangay official or admin role
// CSV Import routes - requires barangay official or admin role
router.post('/import', auth, requireOfficial, upload.single('csvFile'), csvImportController.importTransactions);
router.get('/template', auth, csvImportController.downloadTemplate);

// Standard transaction routes - all authenticated users can view
router.get('/my-transactions', auth, transactionController.getMyTransactions);
router.post('/', auth, requireOfficial, transactionController.createTransaction);
router.post('/batch', auth, requireOfficial, transactionController.processBatch);
router.get('/', auth, transactionController.getTransactions);
router.get('/alerts', auth, transactionController.getAlerts);
router.put('/batch-action', auth, requireOfficial, transactionController.batchAction);
router.delete('/:id', auth, requireOfficial, transactionController.deleteTransaction);
router.put('/:id/approve', auth, requireOfficial, transactionController.approveTransaction);
router.get('/:id', auth, transactionController.getTransactionById);
router.post('/:id/remarks', auth, requireVerifier, transactionController.addRemark);
router.put('/:id/verify', auth, requireVerifier, transactionController.updateVerificationStatus);

module.exports = router;
