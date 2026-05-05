const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    id: {
        type: Number,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    slug: {
        type: String,
        required: true
    },
    products: {
        type: Number,
        default: 0
    },
    pages: {
        type: Number
    }
}, { _id: false });

const brandSchema = new mongoose.Schema({
    id: {
        type: Number,
        default: null
    },
    slug: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    products: {
        type: Number,
        default: 0
    },
    urls: [{
        type: String
    }]
}, { _id: false });

const sitemapAnalysisSchema = new mongoose.Schema({
    source: {
        type: String,
        required: true,
        unique: true
    },
    analyzedAt: {
        type: Date,
        default: Date.now
    },
    summary: {
        totalProducts: {
            type: Number,
            required: true,
            default: 0
        },
        totalBrands: {
            type: Number,
            required: true,
            default: 0
        },
        totalCategories: {
            type: Number,
            required: true,
            default: 0
        }
    },
    categories: [categorySchema],
    brands: [brandSchema],
    productUrls: [{
        type: String
    }],
    brandUrls: [{
        type: String
    }]
}, {
    collection: 'sitemap_analysis',
    timestamps: true
});

sitemapAnalysisSchema.index({ 'brands.slug': 1 });
sitemapAnalysisSchema.index({ 'categories.slug': 1 });

module.exports = mongoose.model('SitemapAnalysis', sitemapAnalysisSchema);