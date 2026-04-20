const express = require('express');
const router = express.Router();
const scraperMonitorController = require('../controllers/scraper_monitor.controller');

/**
 * Rutas del panel de administración para monitoreo de scrapers.
 * Montar en: /admin/scraper
 *
 * Agregar en app.js / index.js:
 *   const adminScraperRoutes = require('./routes/admin_scraper.routes');
 *   app.use('/admin/scraper', adminScraperRoutes);        // sin auth
 *   app.use('/admin/scraper', authMiddleware, adminScraperRoutes);  // con auth
 */

// ── Estado live de la cola ─────────────────────────────────────────────────
// GET /admin/scraper/status
// Devuelve si hay un scraper corriendo, cuántos están en espera y sus IDs.
router.get('/status', scraperMonitorController.getQueueStatus);

// ── Stats del dashboard ────────────────────────────────────────────────────
// GET /admin/scraper/stats
// Devuelve totales: completados, fallidos, en cola, duración promedio.
router.get('/stats', scraperMonitorController.getDashboardStats);

// ── Historial paginado ─────────────────────────────────────────────────────
// GET /admin/scraper/history?page=1&limit=20&status=completed&type=sitemapScraper
router.get('/history', scraperMonitorController.getHistory);

// ── Detalle de un job ──────────────────────────────────────────────────────
// GET /admin/scraper/history/:jobId
router.get('/history/:jobId', scraperMonitorController.getJobDetail);

// ── Disparar scrapers desde el panel ──────────────────────────────────────
// POST /admin/scraper/trigger   body: { scraperType: 'sitemapScraper', ...params }
router.post('/trigger', scraperMonitorController.triggerScraper);

// POST /admin/scraper/analyze
router.post('/analyze', scraperMonitorController.triggerAnalysis);

router.delete('/jobs/all', scraperMonitorController.cancelAllPendingJobs);
router.delete('/jobs/:jobId', scraperMonitorController.cancelJobById);

module.exports = router;
