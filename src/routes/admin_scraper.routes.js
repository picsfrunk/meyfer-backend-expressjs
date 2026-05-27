const express = require('express');
const router = express.Router();
const scraperMonitorController = require('../controllers/scraper_monitor.controller');

router.get('/status', scraperMonitorController.getQueueStatus);
router.get('/stats', scraperMonitorController.getDashboardStats);
router.get('/history', scraperMonitorController.getHistory);
router.get('/history/:jobId', scraperMonitorController.getJobDetail);

router.post('/trigger', scraperMonitorController.triggerScraper);
router.post('/analyze', scraperMonitorController.triggerAnalysis);
router.post('/categories/restore-official', scraperMonitorController.restoreOfficialCategories);
router.post('/categories/reorganize', scraperMonitorController.reorganizeCategories);

router.delete('/jobs/all', scraperMonitorController.cancelAllPendingJobs);
router.delete('/jobs/:jobId', scraperMonitorController.cancelJobById);

module.exports = router;
