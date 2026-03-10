const Config = require('../models/config.model');
const emailService = require('./email.service');

/**
 * Orquestador de acciones tras finalizar el scraping.
 * Ahora recibe opcionalmente `queueInfo` con datos de cola
 * para enriquecer el email.
 */
async function notifyScraper(payload) {
    // Actualizar fecha de última sincronización solo en éxito
    if (payload.status === 'success') {
        await Config.findOneAndUpdate(
            { key: 'last_update' },
            { value: new Date() },
            { upsert: true }
        );
    }

    try {
        await emailService.sendScraperFinishedNotification(payload);
    } catch (error) {
        console.error('[notifier.service] Falló el envío de email:', error.message);
    }

    return { success: true };
}

module.exports = {
    notifyScraper,
};
