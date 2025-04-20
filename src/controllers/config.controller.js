const Config = require('../models/config.model');

// GET /api/config/profit
exports.getProfitMargin = async (req, res) => {
    try {
        const config = await Config.findOne({ key: 'profitMargin' });
        if (!config) {
            return res.status(404).json({ message: 'Profit margin no encontrado.' });
        }
        res.json({ margin: config.value });
    } catch (error) {
        console.error('Error al obtener profit margin:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};

// PUT /api/config/profit
exports.setProfitMargin = async (req, res) => {
    const { margin } = req.body;
    if (typeof margin !== 'number') {
        return res.status(400).json({ message: 'El margen debe ser un número' });
    }

    try {
        const updated = await Config.findOneAndUpdate(
            { key: 'profitMargin' },
            { value: margin },
            { new: true, upsert: true } // crea si no existe
        );
        res.json({ message: 'Profit margin actualizado', margin: updated.value });
    } catch (error) {
        console.error('Error al actualizar profit margin:', error);
        res.status(500).json({ message: 'Error del servidor' });
    }
};
