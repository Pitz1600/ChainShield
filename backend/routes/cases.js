const express = require('express');
const router = express.Router();
const caseController = require('../controllers/caseController');
const auth = require('../middleware/auth');

router.post('/', auth, caseController.createCase);
router.get('/', auth, caseController.getCases);
router.post('/:id/notes', auth, caseController.addNote);

module.exports = router;