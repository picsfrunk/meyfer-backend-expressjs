const axios = require('axios');

/**
 * price_check_monitor.service.js
 *
 * Consulta los resultados de price check almacenados en la colección
 * price_check_results del scraper API.
 *
 * Los resultados NO están en la DB del backend — están en la DB del scraper.
 * Este service los obtiene vía el scraper API, que expone endpoints
 * de consulta sobre esa colección.
 *
 * ALTERNATIVA: si el scraper y el backend comparten la misma instancia de
 * MongoDB, se puede conectar directo con mongoose. Por ahora usamos HTTP
 * para mantener la separación de servicios.
 */

const SCRAPER_BASE = () => {
    const url = process.env.SCRAPER_BASE_URL;
    if (!url) throw { statusCode: 503, message: 'SCRAPER_BASE_URL no está configurada' };
    return url;
};

async function getLatest() {
    try {
        const { data } = await axios.get(`${SCRAPER_BASE()}/scraper/price-check/latest`, {
            timeout: 5000,
        });
        return data;
    } catch (error) {
        if (error.response?.status === 404) return null;
        throw {
            statusCode: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || null,
        };
    }
}

async function getHistory({ page = 1, limit = 20, hasChanges = null } = {}) {
    try {
        const params = { page, limit };
        if (hasChanges !== null) params.hasChanges = hasChanges;

        const { data } = await axios.get(`${SCRAPER_BASE()}/scraper/price-check/history`, {
            params,
            timeout: 5000,
        });
        return data;
    } catch (error) {
        throw {
            statusCode: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || null,
        };
    }
}

async function getById(id) {
    try {
        const { data } = await axios.get(`${SCRAPER_BASE()}/scraper/price-check/history/${id}`, {
            timeout: 5000,
        });
        return data;
    } catch (error) {
        if (error.response?.status === 404) return null;
        throw {
            statusCode: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || null,
        };
    }
}

module.exports = { getLatest, getHistory, getById };
