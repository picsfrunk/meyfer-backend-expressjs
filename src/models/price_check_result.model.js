const mongoose = require('mongoose');

/**
 * Mapea la colección price_check_results creada por el scraper.
 * El scraper la escribe con el driver nativo — este modelo permite
 * al backend leerla directamente sin pasar por la API del scraper.
 */
const priceCheckResultSchema = new mongoose.Schema({
    checkedAt:  { type: Date, required: true, index: true },
    durationMs: { type: Number },
    summary: {
        changed:    { type: Number },
        new:        { type: Number },
        removed:    { type: Number },
        total_odoo: { type: Number },
        total_db:   { type: Number },
        failed:     { type: Number },
        checkedAt:  { type: Date },
        durationMs: { type: Number },
    },
    changedIds:    [String],
    newIds:        [String],
    removedIds:    [String],
    changedDetail: { type: mongoose.Schema.Types.Mixed },
}, {
    collection: 'price_check_results', // nombre exacto que usa el scraper
    timestamps: false,
    strict: false, // tolera campos extra que el scraper pueda agregar
});

module.exports = mongoose.model('PriceCheckResult', priceCheckResultSchema);
