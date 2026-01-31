const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const auth = require('../middleware/auth');
const { requireFraudAccess } = require('../middleware/roleMiddleware');

// All case routes require authentication and fraud access role
router.use(auth);
router.use(requireFraudAccess);

router.post('/', caseController.createCase);
router.get('/', caseController.getCases);
router.post('/:id/notes', caseController.addNote);

module.exports = router;