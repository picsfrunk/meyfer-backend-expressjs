const express = require('express');
const router = express.Router();
const priceListImportController = require('../controllers/price_list_import.controller');

router.get('/settings', priceListImportController.getSettings);
router.put('/settings', priceListImportController.upsertSettings);
router.get('/settings/last-modified', priceListImportController.getLastModified);

router.post('/upload', priceListImportController.uploadManualFile);
router.post('/jobs/from-configured-url', priceListImportController.createJobFromConfiguredUrl);
router.get('/jobs', priceListImportController.getJobs);
router.get('/jobs/:jobId', priceListImportController.getJobById);

module.exports = router;
