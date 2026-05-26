const axios = require('axios');

const trimTrailingSlash = (url) => url.replace(/\/+$/, '');

const resolveScraperUrl = (explicitUrl, fallbackPath, envName) => {
    if (explicitUrl) return explicitUrl;

    if (!process.env.SCRAPER_URL) {
        throw {
            statusCode: 503,
            message: `${envName} o SCRAPER_URL deben estar configuradas en el entorno del backend`,
        };
    }

    return `${trimTrailingSlash(process.env.SCRAPER_URL)}${fallbackPath}`;
};

const postToScraper = async (url, params = {}) => {
    try {
        const response = await axios.post(url, {
            webhookUrl: process.env.WEBHOOK_URL,
            ...params,
        });

        return response.data;
    } catch (error) {
        throw {
            statusCode: error.response?.status || 500,
            message: error.message || 'Error al ejecutar mantenimiento de categorías en el scraper',
            details: error.response?.data || null,
        };
    }
};

const restoreOfficialCategories = async (params = {}) => {
    const url = resolveScraperUrl(
        process.env.SCRAPER_CATEGORIES_RESTORE_URL,
        '/categories/restore-official',
        'SCRAPER_CATEGORIES_RESTORE_URL'
    );

    return postToScraper(url, params);
};

const reorganizeCategories = async (params = {}) => {
    const url = resolveScraperUrl(
        process.env.SCRAPER_CATEGORIES_REORGANIZE_URL,
        '/categories/reorganize',
        'SCRAPER_CATEGORIES_REORGANIZE_URL'
    );

    const {
        categoryIds = 'all',
        pageDelay,
        dryRun = false,
        ...rest
    } = params || {};

    return postToScraper(url, {
        ...rest,
        categoryIds,
        pageDelay,
        dryRun,
    });
};

module.exports = {
    restoreOfficialCategories,
    reorganizeCategories,
};
