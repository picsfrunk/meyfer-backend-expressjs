const mongoose = require('mongoose');

/**
 * Persiste cada job de scraper que pasa por el sistema.
 * Se crea al recibir el webhook 'enqueued' o 'started'
 * y se actualiza al recibir 'completed' o 'failed'.
 */
const scraperJobSchema = new mongoose.Schema({
    // ID único generado por el scraper API (ej: "sitemapScraper-1717000000000-1")
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // Tipo de job
    type: {
        type: String,
        enum: ['sitemapScraper', 'categoryScraper', 'sitemapAnalysis'],
        required: true,
    },

    // Estado actual del job
    status: {
        type: String,
        enum: ['enqueued', 'running', 'completed', 'failed'],
        default: 'enqueued',
        index: true,
    },

    // Posición en la cola cuando fue encolado (0 = arrancó directo)
    queuePosition: {
        type: Number,
        default: 0,
    },

    // Snapshot de cuántos jobs había en cola al momento del enqueue
    pendingAtEnqueue: {
        type: Number,
        default: 0,
    },

    // Timestamps del ciclo de vida
    enqueuedAt:  { type: Date, default: null },
    startedAt:   { type: Date, default: null },
    finishedAt:  { type: Date, default: null },

    // Tiempo total de ejecución en ms (calculado al finalizar)
    durationMs: { type: Number, default: null },

    // Tiempo que esperó en cola (startedAt - enqueuedAt) en ms
    waitTimeMs: { type: Number, default: null },

    // Resultado del job (stats del scraper)
    result: {
        total:         { type: Number, default: null },
        processed:     { type: Number, default: null },
        errors:        { type: Number, default: null },
        uploaded:      { type: Number, default: null },
        orphansDeleted:{ type: Number, default: null },
        durationMs:    { type: Number, default: null },
        error:         { type: String, default: null },  // si falló
    },

    // Snapshot de la cola en el momento del último webhook recibido
    lastQueueSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, {
    timestamps: true, // createdAt, updatedAt automáticos
});

// Índice para queries de historial paginado
scraperJobSchema.index({ createdAt: -1 });
scraperJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ScraperJob', scraperJobSchema);
