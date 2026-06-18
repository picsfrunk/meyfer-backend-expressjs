const multer = require('multer');
const PriceListImportService = require('../services/price_list_import.service');
const { uploadPriceList } = require('../middlewares/upload.middleware');

function handleError(res, error, fallbackMessage = 'Error del servidor') {
    return res.status(error.statusCode || 500).json({
        error: error.message || fallbackMessage,
        details: error.details,
    });
}

function uploadSinglePriceList(req, res) {
    return new Promise((resolve, reject) => {
        uploadPriceList.single('file')(req, res, (error) => {
            if (!error) return resolve();

            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return reject({
                    statusCode: 413,
                    message: 'El archivo supera el tamano maximo permitido',
                    details: { maxSizeBytes: PriceListImportService.MAX_FILE_SIZE_BYTES },
                });
            }

            return reject({
                statusCode: 400,
                message: error.message || 'Archivo invalido',
            });
        });
    });
}

exports.getSettings = async (_req, res) => {
    try {
        const settings = await PriceListImportService.getSettings();
        res.json({ settings });
    } catch (error) {
        handleError(res, error, 'Error al obtener configuracion de lista de precios');
    }
};

exports.upsertSettings = async (req, res) => {
    try {
        const settings = await PriceListImportService.upsertSettings({
            priceListUrl: req.body.priceListUrl,
            user: req.user,
        });
        res.json({ message: 'URL de lista de precios guardada', settings });
    } catch (error) {
        handleError(res, error, 'Error al guardar configuracion de lista de precios');
    }
};

exports.getLastModified = async (_req, res) => {
    try {
        const lastModified = await PriceListImportService.getLastModified();
        if (!lastModified) {
            return res.status(404).json({ message: 'No hay configuracion de lista de precios' });
        }
        res.json(lastModified);
    } catch (error) {
        handleError(res, error, 'Error al consultar ultima modificacion');
    }
};

exports.uploadManualFile = async (req, res) => {
    try {
        await uploadSinglePriceList(req, res);
        const result = await PriceListImportService.createManualUploadJob({
            file: req.file,
            user: req.user,
        });
        res.status(202).json({
            message: 'Archivo recibido; job de importacion encolado',
            job: result.job,
            file: result.file,
        });
    } catch (error) {
        handleError(res, error, 'Error al subir archivo de lista de precios');
    }
};

exports.createJobFromConfiguredUrl = async (req, res) => {
    try {
        const job = await PriceListImportService.createConfiguredUrlJob({ user: req.user });
        res.status(202).json({
            message: 'Job de importacion desde URL configurada encolado',
            job,
        });
    } catch (error) {
        handleError(res, error, 'Error al crear job de importacion');
    }
};

exports.getJobs = async (req, res) => {
    try {
        const result = await PriceListImportService.getJobs(req.query);
        res.json(result);
    } catch (error) {
        handleError(res, error, 'Error al consultar jobs de importacion');
    }
};

exports.getJobById = async (req, res) => {
    try {
        const job = await PriceListImportService.getJobById(req.params.jobId);
        res.json(job);
    } catch (error) {
        handleError(res, error, 'Error al consultar job de importacion');
    }
};

exports.workerUpdateJobResult = async (req, res) => {
    try {
        const job = await PriceListImportService.updateJobResult({
            jobId: req.params.jobId,
            status: req.body.status,
            summary: req.body.summary,
            errors: req.body.errors,
            preview: req.body.preview,
            result: req.body.result,
            details: req.body.details,
        });
        res.json({ message: 'Resultado de importacion persistido', job });
    } catch (error) {
        handleError(res, error, 'Error al persistir resultado de importacion');
    }
};

exports.workerGetImportFile = async (req, res) => {
    try {
        const file = await PriceListImportService.getImportFileForWorker(req.params.fileId);
        res.json({
            id: file._id,
            originalName: file.originalName,
            mimeType: file.mimeType,
            extension: file.extension,
            size: file.size,
            uploadedAt: file.uploadedAt,
            importJobId: file.importJobId,
            expiresAt: file.expiresAt,
            contentBase64: file.buffer.toString('base64'),
        });
    } catch (error) {
        handleError(res, error, 'Error al obtener archivo temporal');
    }
};
