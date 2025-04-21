const Config = require('../models/config.model');

exports.getProfitMargin = async () => {
    try {
        const config = await Config.findOne({ key: 'profitMargin' });
        if (!config) {
            const error = new Error('Profit margin no encontrado.');
            error.statusCode = 404;
            throw error;
        }
        return config.value;
    } catch (error) {
        console.error('Error en ConfigService al obtener profit margin:', error);
        throw error;
    }
};

exports.setProfitMargin = async (margin) => {
    if (typeof margin !== 'number') {
        const error = new Error('El margen debe ser un número');
        error.statusCode = 400;
        throw error;
    }

    try {
        const updated = await Config.findOneAndUpdate(
            { key: 'profitMargin' },
            { value: margin },
            { new: true, upsert: true }
        );
        return updated.value;
    } catch (error) {
        console.error('Error en ConfigService al actualizar profit margin:', error);
        throw error;
    }
};