const mongoose = require('mongoose');

/**
 * Persiste cada job de scraper que pasa por el sistema.
 * Se crea al recibir el webhook 'enqueued' o 'started'
 * y se actualiza al recibir 'completed', 'failed' o 'canceled'.
 */
const scraperJobSchema = new mongoose.Schema({
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    type: {
        type: String,
        enum: [
            'sitemapScraper',
            'categoryScraper',
            'sitemapAnalysis',
            'priceCheck',
            'categoriesRestore',
            'categoriesReorganize',
        ],
        required: true,
    },

    status: {
        type: String,
        enum: ['enqueued', 'running', 'completed', 'failed', 'canceled'],
        default: 'enqueued',
        index: true,
    },

    queuePosition: {
        type: Number,
        default: 0,
    },

    pendingAtEnqueue: {
        type: Number,
        default: 0,
    },

    enqueuedAt:  { type: Date, default: null },
    startedAt:   { type: Date, default: null },
    finishedAt:  { type: Date, default: null },

    durationMs: { type: Number, default: null },
    waitTimeMs: { type: Number, default: null },

    params: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },

    result: {
        total:         { type: Number, default: null },
        processed:     { type: Number, default: null },
        errors:        { type: Number, default: null },
        uploaded:      { type: Number, default: null },
        orphansDeleted:{ type: Number, default: null },
        pagesVisited:  { type: Number, default: null },
        matched:       { type: Number, default: null },
        modified:      { type: Number, default: null },
        dryRun:        { type: Boolean, default: null },
        durationMs:    { type: Number, default: null },
        error:         { type: String, default: null },
    },

    lastQueueSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, {
    timestamps: true,
});

scraperJobSchema.index({ createdAt: -1 });
scraperJobSchema.index({ status: 1, createdAt: -1 });
scraperJobSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('ScraperJob', scraperJobSchema);
