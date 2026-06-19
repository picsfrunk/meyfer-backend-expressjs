const express = require('express');
const webhookRoutes = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { authenticateWebhook } = require('../middlewares/webhookAuth.middleware');

webhookRoutes.post('/scraper/result',       authenticateWebhook, webhookController.scraperFinished);
webhookRoutes.post('/price-check/result',   authenticateWebhook, webhookController.priceCheckFinished);
webhookRoutes.get('/price-list-import/jobs/next', authenticateWebhook, webhookController.getNextPriceListImportJob);
webhookRoutes.post('/price-list-import/jobs/:jobId/claim', authenticateWebhook, webhookController.claimPriceListImportJob);
webhookRoutes.patch('/price-list-import/jobs/:jobId', authenticateWebhook, webhookController.priceListImportJobUpdated);
webhookRoutes.get('/price-list-import/files/:fileId', authenticateWebhook, webhookController.getPriceListImportFile);

module.exports = webhookRoutes;
