const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');
const {
    updateParsedProducts,
    triggerScraper
} = require("../controllers/products.controller");

router.get('/profit', configController.getProfitMargin);
router.put('/profit', configController.setProfitMargin);
router.get('/last-update', configController.getLastUpdateDate);
router.post('/parsed', updateParsedProducts);
router.post('/scrape', triggerScraper);

module.exports = router;
