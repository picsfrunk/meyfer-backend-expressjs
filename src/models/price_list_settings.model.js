const mongoose = require('mongoose');

const priceListSettingsSchema = new mongoose.Schema({
    priceListUrl: {
        type: String,
        default: null,
        trim: true,
    },
    updatedBy: {
        type: String,
        default: null,
    },
    lastImportJobId: {
        type: String,
        default: null,
        index: true,
    },
    lastError: {
        message: { type: String, default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: null },
        at: { type: Date, default: null },
    },
}, {
    timestamps: true,
    collection: 'price_list_settings',
});

module.exports = mongoose.model('PriceListSettings', priceListSettingsSchema);
