const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const csvImportController = require('../controllers/csvImportController');
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/auth');

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

// CSV Import routes
router.post('/import', auth, upload.single('csvFile'), csvImportController.importTransactions);
router.get('/template', auth, csvImportController.downloadTemplate);

// Standard transaction routes
router.post('/', auth, transactionController.createTransaction);
router.get('/', auth, transactionController.getTransactions);
router.get('/alerts', auth, transactionController.getAlerts);
router.get('/:id', auth, transactionController.getTransactionById);

module.exports = router;
