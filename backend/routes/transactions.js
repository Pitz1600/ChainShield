const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csvImportController = require('../controllers/csvImportController');
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/auth');
const { requireOfficial } = require('../middleware/roleMiddleware');

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
        if (path.extname(file.originalname).toLowerCase() !== '.csv') {
            return cb(new Error('Only CSV files are allowed'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// CSV Import routes - requires barangay official or admin role
router.post('/import', auth, requireOfficial, upload.single('csvFile'), csvImportController.importTransactions);
router.get('/template', auth, csvImportController.downloadTemplate);

// Standard transaction routes - all authenticated users can view
router.get('/my-transactions', auth, transactionController.getMyTransactions);
router.post('/', auth, requireOfficial, transactionController.createTransaction);
router.get('/', auth, transactionController.getTransactions);
router.get('/alerts', auth, transactionController.getAlerts);
router.get('/:id', auth, transactionController.getTransactionById);

module.exports = router;
