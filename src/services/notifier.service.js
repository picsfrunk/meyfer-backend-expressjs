const Config = require('../models/config.model');
const emailService = require('./email.service');

/**
 * Orquestador de acciones tras finalizar el scraping
 */
async function notifyScraperDone(payload) {
    await Config.findOneAndUpdate(
        { key: 'last_update' },
        { value: new Date() },
        { upsert: true }
    );

    try {
        await emailService.sendScraperFinishedNotification(payload);
    } catch (error) {
        console.error('[notifier.service] Falló el envío de email:', error.message);
    }

    return { success: true };
}

module.exports = {
    notifyScraperDone,
};