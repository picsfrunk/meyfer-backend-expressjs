const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const {
    updateParsedProducts,
    triggerScraper,
    analyzeSitemap
} = require("../controllers/products.controller");

router.get('/profit', configController.getProfitMargin);
router.put('/profit', configController.setProfitMargin);
router.get('/last-update', configController.getLastUpdateDate);
router.post('/parsed', updateParsedProducts);
router.post('/scrape', triggerScraper);
router.post('/sitemap/analyze', analyzeSitemap);
router.get('/admin-emails', configController.listAdminEmails);
router.post('/admin-emails', configController.addAdminEmail);
router.patch('/admin-emails/deactivate', configController.deactivateAdminEmail);

module.exports = router;
