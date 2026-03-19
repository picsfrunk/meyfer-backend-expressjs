const Config = require('../models/config.model');
const emailService = require('./email.service');

/**
 * Orquestador de acciones tras finalizar el scraping.
 * Recibe opcionalmente `queueInfo` con datos de cola para enriquecer el email.
 */
async function notifyScraper(payload) {
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
        console.error('[notifier.service] Falló el envío de email del scraper:', error.message);
    }

    return { success: true };
}

/**
 * Notificación de resultado de verificación de precios.
 * Se llama desde webhook.controller cuando llega el resultado del priceChecker.
 */
async function notifyPriceCheck(payload) {
    try {
        await emailService.sendPriceCheckNotification(payload);
    } catch (error) {
        console.error('[notifier.service] Falló el envío de email del price check:', error.message);
    }

    return { success: true };
}

module.exports = {
    notifyScraper,
    notifyPriceCheck,
};
