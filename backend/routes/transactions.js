const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const auth = require('../middleware/auth');

router.post('/', auth, transactionController.createTransaction);
router.get('/', auth, transactionController.getTransactions);
router.get('/:id', auth, transactionController.getTransactionById);

module.exports = router;
