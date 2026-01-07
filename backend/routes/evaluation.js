const express = require('express');
const router = express.Router();
const evaluationController = require('../controllers/evaluationController');
const auth = require('../middleware/auth');

// Get evaluation metrics (Precision, Recall, F1-score, False Positive Rate)
router.get('/metrics', auth, evaluationController.getEvaluationMetrics);

// Get model performance statistics
router.get('/performance', auth, evaluationController.getModelPerformance);

module.exports = router;
