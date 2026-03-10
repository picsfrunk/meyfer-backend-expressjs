const ScraperMonitor = require('../services/scraper_monitor.service');
const ProductsService = require('../services/products.service');

/**
 * GET /admin/scraper/status
 * Estado live de la cola: job corriendo, jobs en espera.
 */
exports.getQueueStatus = async (req, res) => {
    try {
        const status = await ScraperMonitor.getLiveStatus();
        res.json(status);
    } catch (error) {
        console.error('[scraper_monitor] Error en getQueueStatus:', error);
        res.status(500).json({ message: 'Error al obtener estado de la cola' });
    }
};

/**
 * GET /admin/scraper/history
 * Historial paginado de jobs.
 *
 * Query params:
 *   page    (default 1)
 *   limit   (default 20)
 *   status  'enqueued' | 'running' | 'completed' | 'failed'
 *   type    'sitemapScraper' | 'categoryScraper' | 'sitemapAnalysis'
 */
exports.getHistory = async (req, res) => {
    try {
        const { page, limit, status, type } = req.query;
        const result = await ScraperMonitor.getJobHistory({
            page:   parseInt(page)  || 1,
            limit:  parseInt(limit) || 20,
            status: status || null,
            type:   type   || null,
        });
        res.json(result);
    } catch (error) {
        console.error('[scraper_monitor] Error en getHistory:', error);
        res.status(500).json({ message: 'Error al obtener historial' });
    }
};

/**
 * GET /admin/scraper/history/:jobId
 * Detalle de un job específico.
 */
exports.getJobDetail = async (req, res) => {
    try {
        const job = await ScraperMonitor.getJobById(req.params.jobId);
        if (!job) return res.status(404).json({ message: 'Job no encontrado' });
        res.json(job);
    } catch (error) {
        console.error('[scraper_monitor] Error en getJobDetail:', error);
        res.status(500).json({ message: 'Error al obtener detalle del job' });
    }
};

/**
 * GET /admin/scraper/stats
 * Stats resumidas para el dashboard: totales, tasa de error, duración promedio.
 */
exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await ScraperMonitor.getDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('[scraper_monitor] Error en getDashboardStats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

/**
 * POST /admin/scraper/trigger
 * Dispara un scraper desde el panel admin (igual que config.routes pero centralizado).
 *
 * Body: { scraperType: 'sitemapScraper' | 'categoryScraper', ...params }
 */
exports.triggerScraper = async (req, res) => {
    const { scraperType, ...params } = req.body;
    try {
        const result = await ProductsService.runScraper(scraperType, params);
        res.status(202).json({
            message: 'Scraper encolado/iniciado',
            scraperType,
            result,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al ejecutar scraper',
            details: error.details,
        });
    }
};

/**
 * POST /admin/scraper/analyze
 * Dispara el análisis de sitemap desde el panel admin.
 */
exports.triggerAnalysis = async (req, res) => {
    try {
        const result = await ProductsService.runSitemapAnalysis(req.body);
        res.status(202).json({ message: 'Análisis encolado/iniciado', result });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al ejecutar análisis',
            details: error.details,
        });
    }
};
