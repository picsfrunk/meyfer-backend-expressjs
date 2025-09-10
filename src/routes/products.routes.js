const express = require('express');
const router = express.Router();
const { getParsedProducts, updateParsedProducts, triggerScraper,
    getScrapedProducts, getScrapedProductById
} = require('../controllers/products.controller');

router.get('/parsed', getParsedProducts);
router.get('/scraped', getScrapedProducts);
router.get('/scraped/:id', getScrapedProductById);

module.exports = router;