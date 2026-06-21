const express = require('express');
const router = express.Router();
const priceListImportController = require('../controllers/price_list_import.controller');
const { authenticateWebhook } = require('../middlewares/webhookAuth.middleware');

router.get('/files/:fileId', authenticateWebhook, priceListImportController.downloadTemporaryFile);

module.exports = router;
