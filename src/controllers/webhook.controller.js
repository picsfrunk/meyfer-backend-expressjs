const notifierService = require('../services/notifier.service');
const Config = require('../models/config.model');

exports.scraperFinished = async (req, res) => {
    try {
        const { source, status, processed, timestamp } = req.body;

        if (!source || !status || typeof processed !== 'number') {
            return res.status(400).json({ message: 'Faltan campos requeridos o son inválidos' });
        }

        const now = new Date();
        await Config.findOneAndUpdate(
            { key: 'last_update' },
            { value: now },
            { upsert: true, new: true }
        );

        notifierService.notifyClients('scraper:done', {
            source,
            status,
            processed,
            timestamp: timestamp || new Date().toISOString(),
        });

        res.status(200).json({ message: 'Webhook recibido correctamente' });
    } catch (error) {
        console.error('Error en webhook /scraper:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};
