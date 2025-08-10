const mongoose = require('mongoose');

const ScrapedProductSchema =
    new mongoose.Schema({}, { strict: false, collection: 'scraped-products' });

module.exports = mongoose.model('ScrapedProduct', ScrapedProductSchema);