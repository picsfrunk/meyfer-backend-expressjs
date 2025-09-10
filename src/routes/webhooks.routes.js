const express = require('express');
const webhookRoutes = express.Router();
const webhookController = require('../controllers/webhook.controller');

webhookRoutes.post('/scraper', webhookController.scraperFinished);

module.exports = webhookRoutes;