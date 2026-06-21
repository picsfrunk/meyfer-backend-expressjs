const PriceListImportService = require('../services/price_list_import.service');

exports.getSettings = async (_req, res) => {
    try {
        const settings = await PriceListImportService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al obtener configuración de lista de precios',
            details: error.details,
        });
    }
};

exports.saveSettings = async (req, res) => {
    try {
        const settings = await PriceListImportService.saveSettings(req.body.sourceUrl);
        res.json({ message: 'URL de lista de precios guardada', settings });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al guardar configuración de lista de precios',
            details: error.details,
        });
    }
};

exports.importFromConfiguredUrl = async (_req, res) => {
    try {
        const result = await PriceListImportService.importFromConfiguredUrl();
        res.status(202).json({
            message: 'Importación de lista de precios iniciada',
            jobId: result.jobId,
            result,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al iniciar importación de lista de precios',
            details: error.details,
        });
    }
};

exports.importManualUpload = async (req, res) => {
    try {
        const result = await PriceListImportService.importManualUpload(req.file);
        res.status(202).json({
            message: 'Importación manual de lista de precios iniciada',
            jobId: result.jobId,
            fileId: result.fileId,
            result,
        });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al iniciar importación manual de lista de precios',
            details: error.details,
        });
    }
};

exports.downloadTemporaryFile = async (req, res) => {
    try {
        const file = await PriceListImportService.downloadTemporaryFile(req.params.fileId);
        res.setHeader('Content-Type', file.mimeType);
        res.setHeader('Content-Length', file.size);
        res.download(file.filePath, file.fileName);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            message: error.message || 'Error al descargar archivo temporal',
            details: error.details,
        });
    }
};
