const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const auth = require('../middleware/auth');

router.get('/', auth, alertController.getAlerts);
router.patch('/:id', auth, alertController.updateAlertStatus);
router.get('/stats', auth, alertController.getAlertStats);

module.exports = router;