const ConfigService = require('../services/config.service');

exports.getProfitMargin = async (req, res) => {
    try {
        const profitMargin = await ConfigService.getProfitMargin();
        res.json({ margin: profitMargin });
    } catch (error) {
        console.error('Error al obtener profit margin:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error del servidor' });
    }
};

exports.setProfitMargin = async (req, res) => {
    const { margin } = req.body;
    try {
        const updatedMargin = await ConfigService.setProfitMargin(margin);
        res.json({ message: 'Profit margin actualizado', margin: updatedMargin });
    } catch (error) {
        console.error('Error al actualizar profit margin:', error);
        res.status(error.statusCode || 400).json({ message: error.message || 'Error del servidor' });
    }
};
