const express = require('express');
const router = express.Router();
const { getParsedProducts, updateParsedProducts, triggerScraper,
    getScrapedProducts
} = require('../controllers/products.controller');

router.get('/parsed', getParsedProducts);
router.post('/parsed', updateParsedProducts);
router.post('/scrape', triggerScraper);
router.get('/scraped', getScrapedProducts);

module.exports = router;