const axios     = require('axios');
const logToFile = require('../utils/logToFile');
const { checkPrices } = require('../../scraper/priceChecker');

/**
 * Ejecuta el check de precios y notifica por webhook si se provee URL.
 *
 * El webhook manda:
 *  - summary: estadísticas generales
 *  - changed: array completo con product_id, display_name, old_price, new_price, diff, diff_percent
 *    (necesario para que el backend genere el email con detalle)
 *  - newIds / removedIds: solo IDs para mantener el payload liviano
 *    (el detalle completo de new/removed queda en price_check_results en MongoDB)
 */
async function runPriceCheck({ webhookUrl } = {}) {
    try {
        const result = await checkPrices();

        if (webhookUrl) {
            await _notifyWebhook(webhookUrl, {
                source:     'priceChecker',
                status:     'success',
                summary:    result.summary,
                changed:    result.changed,       // detalle completo para el email
                newIds:     result.newIds,         // solo IDs
                removedIds: result.removedIds,     // solo IDs
            });
        }

        return result;
    } catch (error) {
        await logToFile.error(`Error en runPriceCheck: ${error.message}`, 'priceCheckerService');

        if (webhookUrl) {
            await _notifyWebhook(webhookUrl, {
                source: 'priceChecker',
                status: 'error',
                error:  error.message,
            });
        }
        throw error;
    }
}

async function _notifyWebhook(webhookUrl, payload) {
    try {
        await axios.post(webhookUrl, { ...payload, timestamp: new Date().toISOString() });
        await logToFile.info('Webhook enviado', 'priceCheckerService', { status: payload.status });
    } catch (err) {
        await logToFile.error(`Error enviando webhook: ${err.message}`, 'priceCheckerService');
    }
}

module.exports = { runPriceCheck };
