const express = require('express');
const router = express.Router();
const dataGovPhController = require('../controllers/dataGovPhController');
const auth = require('../middleware/auth');

// Scan and ingest data from data.gov.ph
router.post('/scan', auth, dataGovPhController.scanAndIngest);

// Search datasets on data.gov.ph
router.get('/search', auth, dataGovPhController.searchDatasets);

module.exports = router;
