const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', auth, requireRole(['auditor', 'administrator']), alertController.getAlerts);
router.patch('/:id', auth, requireRole(['auditor', 'administrator']), alertController.updateAlertStatus);
router.get('/stats', auth, requireRole(['auditor', 'administrator']), alertController.getAlertStats);

module.exports = router;