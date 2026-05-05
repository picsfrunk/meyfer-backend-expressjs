const express = require('express');
const webhookRoutes = express.Router();
const webhookController = require('../controllers/webhook.controller');

webhookRoutes.post('/scraper/result',       webhookController.scraperFinished);
webhookRoutes.post('/price-check/result',   webhookController.priceCheckFinished);

module.exports = webhookRoutes;
