const crypto = require('crypto');

const SECRET_HEADER = 'X-Webhook-Secret';

function hashSecret(value) {
    return crypto.createHash('sha256').update(value, 'utf8').digest();
}

function secretsMatch(receivedSecret, configuredSecret) {
    const receivedHash = hashSecret(receivedSecret);
    const configuredHash = hashSecret(configuredSecret);

    return crypto.timingSafeEqual(receivedHash, configuredHash);
}

function authenticateWebhook(req, res, next) {
    const configuredSecret = process.env.SCRAPER_WEBHOOK_SECRET;

    if (!configuredSecret) {
        console.error('[webhook-auth] SCRAPER_WEBHOOK_SECRET is not configured');
        return res.status(503).json({ message: 'SCRAPER_WEBHOOK_SECRET is not configured' });
    }

    const receivedSecret = req.get(SECRET_HEADER);

    if (!receivedSecret) {
        console.warn('[webhook-auth] missing secret header');
        return res.status(401).json({ message: 'Webhook secret required' });
    }

    if (!secretsMatch(receivedSecret, configuredSecret)) {
        console.warn('[webhook-auth] invalid secret');
        return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    return next();
}

module.exports = {
    authenticateWebhook,
};
