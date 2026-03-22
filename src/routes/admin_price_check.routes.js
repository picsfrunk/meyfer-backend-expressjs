const express = require('express');
const router = express.Router();
const priceCheckMonitorController = require('../controllers/price_check_monitor.controller');

/**
 * Rutas de consulta de resultados de price check.
 * Montar en api.routes.js:
 *   router.use('/admin/price-check', authenticateAdmin, adminPriceCheckRoutes);
 */

router.get('/latest',         priceCheckMonitorController.getLatest);
router.get('/history',        priceCheckMonitorController.getHistory);
router.get('/history/:id',    priceCheckMonitorController.getById);

module.exports = router;
