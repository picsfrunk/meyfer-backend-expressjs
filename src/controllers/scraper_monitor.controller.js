const ScraperMonitor = require('../services/scraper_monitor.service');
const ProductsService = require('../services/products.service');
const CategoryMaintenanceService = require('../services/scraper_category_maintenance.service');

exports.getQueueStatus = async (req, res) => {
    try {
        const status = await ScraperMonitor.getLiveStatus();
        res.json(status);
    } catch (error) {
        console.error('[scraper_monitor] Error en getQueueStatus:', error);
        res.status(500).json({ message: 'Error al obtener estado de la cola' });
    }
};

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

exports.getDashboardStats = async (req, res) => {
    try {
        const stats = await ScraperMonitor.getDashboardStats();
        res.json(stats);
    } catch (error) {
        console.error('[scraper_monitor] Error en getDashboardStats:', error);
        res.status(500).json({ message: 'Error al obtener estadísticas' });
    }
};

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

exports.restoreOfficialCategories = async (req, res) => {
    try {
        const result = await CategoryMaintenanceService.restoreOfficialCategories(req.body);
        res.status(202).json({
            message: 'Restauración de categorías oficiales encolada/iniciada',
            result,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al restaurar categorías oficiales',
            details: error.details,
        });
    }
};

exports.reorganizeCategories = async (req, res) => {
    try {
        const result = await CategoryMaintenanceService.reorganizeCategories(req.body);
        res.status(202).json({
            message: 'Reorganización de categorías encolada/iniciada',
            result,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al reorganizar categorías',
            details: error.details,
        });
    }
};

exports.cancelJobById = async (req, res, next) => {
    try {
        const { jobId } = req.params;
        const result = await ScraperMonitor.cancelJobById(jobId);
        return res.status(result.httpStatus || 200).json(result);
    } catch (error) {
        next(error);
    }
};

exports.cancelAllPendingJobs = async (req, res, next) => {
    try {
        const result = await ScraperMonitor.cancelAllPendingJobs();
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
