const mongoose = require('mongoose');

const priceListImportFileSchema = new mongoose.Schema({
    originalName: {
        type: String,
        required: true,
    },
    mimeType: {
        type: String,
        default: null,
    },
    extension: {
        type: String,
        enum: ['.csv', '.xlsx'],
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    buffer: {
        type: Buffer,
        required: true,
        select: false,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    uploadedBy: {
        type: String,
        default: null,
    },
    importJobId: {
        type: String,
        required: true,
        index: true,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
}, {
    timestamps: true,
    collection: 'price_list_import_files',
});

module.exports = mongoose.model('PriceListImportFile', priceListImportFileSchema);
