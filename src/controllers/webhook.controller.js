const {notifyScraperDone} = require("../services/notifier.service");

exports.scraperFinished = async (req, res) => {
    try {
        const { source, status, processed, stats, timestamp } = req.body;

        if (!source || !status) {
            return res.status(400).json({ message: 'Faltan campos source o status' });
        }

        await notifyScraperDone({
            source,
            status,
            processed: processed || 0,
            stats: stats || {},
            timestamp: timestamp || new Date().toISOString()
        });

        res.status(200).json({ message: 'Webhook procesado' });
    } catch (error) {
        console.error('Error en webhook /scraper:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};