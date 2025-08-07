const express = require('express');
const router = express.Router();
const { getParsedProducts, updateParsedProducts, triggerScraper } = require('../controllers/products.controller');

router.get('/parsed', getParsedProducts);
router.post('/parsed', updateParsedProducts);
router.post('/scrape', triggerScraper)

module.exports = router;