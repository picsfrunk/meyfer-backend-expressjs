const Config = require('../models/config.model');
const emailService = require('./email.service');

const CATEGORY_MAINTENANCE_TYPES = ['categoriesRestore', 'categoriesReorganize'];

async function notifyScraper(payload) {
    const shouldUpdateCatalogTimestamp = payload.status === 'success'
        && !CATEGORY_MAINTENANCE_TYPES.includes(payload.source);

    if (shouldUpdateCatalogTimestamp) {
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

async function notifyPriceCheck(payload) {
    try {
        await emailService.sendPriceCheckNotification(payload);
    } catch (error) {
        console.error('[notifier.service] Falló el envío de email del price check:', error.message);
    }

    return { success: true };
}

async function notifyPriceListImport(payload) {
    try {
        await emailService.sendPriceListImportNotification(payload);
    } catch (error) {
        console.error('[notifier.service] Falló el envío de email de importación de lista de precios:', error.message);
    }

    return { success: true };
}

module.exports = {
    notifyScraper,
    notifyPriceCheck,
    notifyPriceListImport,
};
