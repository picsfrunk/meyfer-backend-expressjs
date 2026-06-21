const mongoose = require('mongoose');

const priceListImportJobSchema = new mongoose.Schema({
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    scraperJobId: {
        type: String,
        default: null,
        index: true,
    },
    backendImportJobId: {
        type: String,
        default: null,
        index: true,
    },
    type: {
        type: String,
        enum: ['price-list-import'],
        default: 'price-list-import',
        required: true,
    },
    source: {
        type: String,
        enum: ['manual_upload', 'remote_configured_url'],
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['queued', 'running', 'completed', 'failed', 'canceled'],
        default: 'queued',
        index: true,
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PriceListImportFile',
        default: null,
        index: true,
    },
    sourceUrl: {
        type: String,
        default: null,
    },
    queuedAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    startedAt: {
        type: Date,
        default: null,
    },
    finishedAt: {
        type: Date,
        default: null,
    },
    requestedBy: {
        type: String,
        default: null,
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    summary: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    errors: {
        type: [mongoose.Schema.Types.Mixed],
        default: [],
    },
    preview: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    lastError: {
        message: { type: String, default: null },
        details: { type: mongoose.Schema.Types.Mixed, default: null },
        at: { type: Date, default: null },
    },
}, {
    timestamps: true,
    collection: 'price_list_import_jobs',
    suppressReservedKeysWarning: true,
});

priceListImportJobSchema.index({ status: 1, queuedAt: -1 });
priceListImportJobSchema.index({ type: 1, queuedAt: -1 });

module.exports = mongoose.model('PriceListImportJob', priceListImportJobSchema);
