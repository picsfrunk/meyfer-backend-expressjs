const mongoose = require('mongoose');

const scrapedProductSchema =
    new mongoose.Schema({
        display_name: { type: String, required: true },
    }, { strict: false, collection: 'scraped-products' });

scrapedProductSchema.index({ display_name: 'text' });

module.exports = mongoose.model('ScrapedProduct', scrapedProductSchema);