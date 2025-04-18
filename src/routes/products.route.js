const express = require('express');
const router = express.Router();
const { getParsedProducts } = require('../controllers/products.controller');

router.get('/parsed', getParsedProducts);

module.exports = router;