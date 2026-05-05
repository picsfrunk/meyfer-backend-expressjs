const PriceCheckMonitor = require('../services/price_check_monitor.service');

/**
 * GET /admin/price-check/latest
 */
exports.getLatest = async (req, res) => {
    try {
        const result = await PriceCheckMonitor.getLatest();
        if (!result) return res.status(404).json({ message: 'No hay resultados de price check aún' });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message, details: error.details });
    }
};

/**
 * GET /admin/price-check/history
 * Query: page, limit, hasChanges
 */
exports.getHistory = async (req, res) => {
    try {
        const { page, limit, hasChanges } = req.query;
        const result = await PriceCheckMonitor.getHistory({
            page:       parseInt(page)  || 1,
            limit:      parseInt(limit) || 20,
            hasChanges: hasChanges === 'true' ? true : hasChanges === 'false' ? false : null,
        });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message, details: error.details });
    }
};

/**
 * GET /admin/price-check/history/:id
 */
exports.getById = async (req, res) => {
    try {
        const result = await PriceCheckMonitor.getById(req.params.id);
        if (!result) return res.status(404).json({ message: 'Resultado no encontrado' });
        res.json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({ message: error.message, details: error.details });
    }
};
