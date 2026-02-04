const Config = require('../models/config.model');
const emailService = require('./email.service');

async function notifyScraperDone(payload) {
    const { source, status, processed, timestamp } = payload;

    const now = new Date();
    await Config.findOneAndUpdate(
        { key: 'last_update' },
        { value: now },
        { upsert: true, new: true }
    );

    // console.log(`\n📣 Scraper Finalizado: ${source} (${status})`);

    try {
        await emailService.sendScraperFinishedNotification(payload);
    } catch (error) {
        console.error('❌ Error enviando email post-scraper:', error.message);
    }

    return { lastUpdate: now };
}

module.exports = {
    notifyScraperDone,
};