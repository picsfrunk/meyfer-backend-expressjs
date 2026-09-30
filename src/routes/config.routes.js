const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const {
    triggerScraper,
    analyzeSitemap,
    checkPrices,
} = require("../controllers/products.controller");

router.get('/profit', configController.getProfitMargin);
router.put('/profit', configController.setProfitMargin);
router.get('/last-update', configController.getLastUpdateDate);
router.post('/scrape', triggerScraper);
router.post('/sitemap/analyze', analyzeSitemap);
router.post('/price-check', checkPrices);
router.get('/admin-emails', configController.listAdminEmails);
router.post('/admin-emails', configController.addAdminEmail);
router.patch('/admin-emails/deactivate', configController.deactivateAdminEmail);

module.exports = router;
