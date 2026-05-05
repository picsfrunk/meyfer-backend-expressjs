const PriceCheckResult = require('../models/price_check_result.model');

/**
 * price_check_monitor.service.js
 *
 * Lee la colección price_check_results directamente desde MongoDB.
 * Backend y scraper comparten la misma instancia — no hay necesidad
 * de pasar por la API HTTP del scraper.
 */

async function getLatest() {
    return PriceCheckResult
        .findOne()
        .sort({ checkedAt: -1 })
        .lean();
}

async function getHistory({ page = 1, limit = 20, hasChanges = null } = {}) {
    const filter = {};
    if (hasChanges === true)  filter['summary.changed'] = { $gt: 0 };
    if (hasChanges === false) filter['summary.changed'] = 0;

    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
        PriceCheckResult
            .find(filter, { changedDetail: 0 }) // excluir detalle en el listado
            .sort({ checkedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        PriceCheckResult.countDocuments(filter),
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        results,
    };
}

async function getById(id) {
    // Validar que sea un ObjectId válido antes de consultar
    if (!id.match(/^[a-f\d]{24}$/i)) return null;

    return PriceCheckResult
        .findById(id)
        .lean();
}

module.exports = { getLatest, getHistory, getById };
