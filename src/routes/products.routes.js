const express = require('express');
const router = express.Router();
const { getParsedProducts, updateParsedProducts, triggerScraper,
    getScrapedProducts, getScrapedProductById
} = require('../controllers/products.controller');
const {limiter} = require("../middlewares/limiter.middleware");

router.get('/parsed', getParsedProducts);
router.get('/scraped', limiter, getScrapedProducts);
router.get('/scraped/:id', getScrapedProductById);

module.exports = router;