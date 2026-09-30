const express = require('express');
const webhookRoutes = express.Router();
const webhookController = require('../controllers/webhook.controller');
const priceListImportController = require('../controllers/price_list_import.controller');
const { authenticateWebhook } = require('../middlewares/webhookAuth.middleware');

webhookRoutes.post('/scraper/result',       authenticateWebhook, webhookController.scraperFinished);
webhookRoutes.post('/price-check/result',   authenticateWebhook, webhookController.priceCheckFinished);
webhookRoutes.post('/price-list-import/result', authenticateWebhook, webhookController.priceListImportFinished);
webhookRoutes.get('/price-list-import/files/:fileId', authenticateWebhook, priceListImportController.downloadTemporaryFile);

module.exports = webhookRoutes;
