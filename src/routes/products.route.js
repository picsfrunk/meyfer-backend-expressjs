const express = require('express');
const router = express.Router();
const { getParsedProducts, updateParsedProducts } = require('../controllers/products.controller');

router.get('/parsed', getParsedProducts);
router.post('/parsed', updateParsedProducts);

module.exports = router;