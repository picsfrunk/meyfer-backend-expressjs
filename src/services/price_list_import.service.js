const crypto = require('crypto');
const path = require('path');
const axios = require('axios');
const PriceListSettings = require('../models/price_list_settings.model');
const PriceListImportFile = require('../models/price_list_import_file.model');
const PriceListImportJob = require('../models/price_list_import_job.model');

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx'];
const ALLOWED_MIME_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const FILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function generateJobId() {
    return `pli_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}

function getPriceListImportScraperUrl() {
    if (process.env.PRICE_LIST_IMPORT_SCRAPER_URL) {
        return process.env.PRICE_LIST_IMPORT_SCRAPER_URL;
    }

    if (process.env.SCRAPER_API_URL) {
        return `${trimTrailingSlash(process.env.SCRAPER_API_URL)}/scraper/price-list-import`;
    }

    if (process.env.SCRAPER_BASE_URL) {
        return `${trimTrailingSlash(process.env.SCRAPER_BASE_URL)}/api/scraper/price-list-import`;
    }

    if (process.env.SCRAPER_URL) {
        return `${trimTrailingSlash(process.env.SCRAPER_URL)}/price-list-import`;
    }

    throw {
        statusCode: 503,
        message: 'PRICE_LIST_IMPORT_SCRAPER_URL no está configurada en el entorno del backend',
    };
}

function getPriceListImportWebhookUrl() {
    const webhookUrl = process.env.WEBHOOK_PRICE_LIST_IMPORT_URL || process.env.WEBHOOK_URL;
    if (!webhookUrl) {
        throw {
            statusCode: 503,
            message: 'WEBHOOK_PRICE_LIST_IMPORT_URL o WEBHOOK_URL deben estar configuradas en el entorno del backend',
        };
    }
    return webhookUrl;
}

function getScraperJobId(responseData) {
    return responseData?.jobId || responseData?.job?.id || responseData?.id || null;
}

async function triggerPriceListImportScraper(payload) {
    const url = getPriceListImportScraperUrl();
    const webhookUrl = getPriceListImportWebhookUrl();

    try {
        const response = await axios.post(url, { webhookUrl, ...payload });
        const scraperJobId = getScraperJobId(response.data);

        if (!scraperJobId) {
            throw {
                statusCode: 502,
                message: 'El scraper no devolvio jobId para la importacion de lista de precios',
                details: response.data ?? null,
            };
        }

        return { scraperJobId, response: response.data };
    } catch (error) {
        if (error.statusCode) throw error;

        throw {
            statusCode: error.response?.status || 502,
            message: error.message || 'Error al iniciar importacion de lista de precios en scraper',
            details: error.response?.data || null,
        };
    }
}

function getActor(user) {
    return user?.username || user?.email || 'admin';
}

function normalizeUrl(priceListUrl) {
    if (typeof priceListUrl !== 'string' || !priceListUrl.trim()) {
        throw {
            statusCode: 400,
            message: 'priceListUrl es requerido',
            details: { field: 'priceListUrl' },
        };
    }

    const trimmed = priceListUrl.trim();
    try {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Unsupported protocol');
        }
    } catch (_error) {
        throw {
            statusCode: 400,
            message: 'priceListUrl debe ser una URL http(s) valida',
            details: { field: 'priceListUrl', value: priceListUrl },
        };
    }

    return trimmed;
}

async function getSettings() {
    return PriceListSettings.findOne().sort({ updatedAt: -1 }).lean();
}

async function upsertSettings({ priceListUrl, user }) {
    const normalizedUrl = normalizeUrl(priceListUrl);
    const actor = getActor(user);

    return PriceListSettings.findOneAndUpdate(
        {},
        {
            $set: {
                priceListUrl: normalizedUrl,
                updatedBy: actor,
                lastError: null,
            },
        },
        { upsert: true, new: true, sort: { updatedAt: -1 } }
    ).lean();
}

async function getLastModified() {
    const settings = await getSettings();
    if (!settings) return null;

    return {
        updatedAt: settings.updatedAt,
        updatedBy: settings.updatedBy ?? null,
        lastImportJobId: settings.lastImportJobId ?? null,
        lastError: settings.lastError ?? null,
    };
}

function validateImportFile(file) {
    if (!file) {
        throw {
            statusCode: 400,
            message: 'Archivo requerido',
            details: { field: 'file' },
        };
    }

    const originalName = file.originalname || '';
    const extension = path.extname(originalName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw {
            statusCode: 400,
            message: 'Extension de archivo no permitida',
            details: { allowedExtensions: ALLOWED_EXTENSIONS, extension },
        };
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw {
            statusCode: 400,
            message: 'MIME type no permitido',
            details: { allowedMimeTypes: ALLOWED_MIME_TYPES, mimeType: file.mimetype },
        };
    }

    if (!file.size || file.size <= 0 || !file.buffer?.length) {
        throw {
            statusCode: 400,
            message: 'El archivo esta vacio',
            details: { size: file.size ?? 0 },
        };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        throw {
            statusCode: 413,
            message: 'El archivo supera el tamano maximo permitido',
            details: { maxSizeBytes: MAX_FILE_SIZE_BYTES, size: file.size },
        };
    }

    return extension;
}

async function createManualUploadJob({ file, user }) {
    const extension = validateImportFile(file);
    const actor = getActor(user);
    const backendImportJobId = generateJobId();
    const now = new Date();

    const importFile = await PriceListImportFile.create({
        originalName: file.originalname,
        mimeType: file.mimetype || null,
        extension,
        size: file.size,
        buffer: file.buffer,
        uploadedAt: now,
        uploadedBy: actor,
        importJobId: backendImportJobId,
        expiresAt: new Date(now.getTime() + FILE_TTL_MS),
    });

    let scraperAccepted = false;
    try {
        const metadata = {
            originalName: file.originalname,
            mimeType: file.mimetype || null,
            size: file.size,
            extension,
        };
        const { scraperJobId, response } = await triggerPriceListImportScraper({
            source: 'manual_upload',
            fileId: importFile._id.toString(),
            metadata,
            backendImportJobId,
            requestId: backendImportJobId,
        });
        scraperAccepted = true;

        const job = await PriceListImportJob.create({
            jobId: scraperJobId,
            scraperJobId,
            backendImportJobId,
            type: 'price-list-import',
            source: 'manual_upload',
            status: 'queued',
            fileId: importFile._id,
            queuedAt: now,
            requestedBy: actor,
            metadata: { ...metadata, scraperResponse: response },
        });

        await PriceListSettings.findOneAndUpdate(
            {},
            { $set: { lastImportJobId: scraperJobId, lastError: null } },
            { upsert: true, new: true, sort: { updatedAt: -1 } }
        );

        return {
            job: job.toObject(),
            scraperJobId,
            backendImportJobId,
            scraperResponse: response,
            file: {
                id: importFile._id,
                originalName: importFile.originalName,
                mimeType: importFile.mimeType,
                size: importFile.size,
                uploadedAt: importFile.uploadedAt,
                importJobId: importFile.importJobId,
                expiresAt: importFile.expiresAt,
            },
        };
    } catch (error) {
        if (!scraperAccepted) {
            await PriceListImportFile.deleteOne({ _id: importFile._id });
        }
        throw error;
    }
}

async function createConfiguredUrlJob({ user }) {
    const settings = await getSettings();
    if (!settings?.priceListUrl) {
        throw {
            statusCode: 400,
            message: 'No hay URL de lista de precios configurada',
            details: { field: 'priceListUrl' },
        };
    }

    const backendImportJobId = generateJobId();
    const { scraperJobId, response } = await triggerPriceListImportScraper({
        source: 'remote_configured_url',
        sourceUrl: settings.priceListUrl,
        metadata: { configuredSettingsId: settings._id?.toString?.() ?? String(settings._id) },
        backendImportJobId,
        requestId: backendImportJobId,
    });

    const job = await PriceListImportJob.create({
        jobId: scraperJobId,
        scraperJobId,
        backendImportJobId,
        type: 'price-list-import',
        source: 'remote_configured_url',
        status: 'queued',
        sourceUrl: settings.priceListUrl,
        queuedAt: new Date(),
        requestedBy: getActor(user),
        metadata: { scraperResponse: response },
    });

    await PriceListSettings.findByIdAndUpdate(settings._id, {
        $set: {
            lastImportJobId: scraperJobId,
            lastError: null,
        },
    });

    const jobObject = job.toObject();
    return {
        ...jobObject,
        scraperJobId,
        backendImportJobId,
        scraperResponse: response,
    };
}

async function getJobs({ page = 1, limit = 20, status = null, source = null } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (source) filter.source = source;

    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const [jobs, total] = await Promise.all([
        PriceListImportJob.find(filter)
            .sort({ queuedAt: -1 })
            .skip(skip)
            .limit(safeLimit)
            .lean(),
        PriceListImportJob.countDocuments(filter),
    ]);

    return {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
        jobs,
    };
}

async function getJobById(jobId) {
    const job = await PriceListImportJob.findOne({
        $or: [
            { jobId },
            { scraperJobId: jobId },
            { backendImportJobId: jobId },
        ],
    }).lean();
    if (!job) {
        throw { statusCode: 404, message: 'Job de importacion no encontrado' };
    }
    return job;
}

async function updateJobResult({ jobId, status, summary, errors, preview, result, details }) {
    const allowedStatuses = ['queued', 'running', 'completed', 'failed', 'canceled'];
    if (!allowedStatuses.includes(status)) {
        throw {
            statusCode: 400,
            message: 'Estado de job invalido',
            details: { status, allowedStatuses },
        };
    }

    const identityFilter = {
        $or: [
            { jobId },
            { scraperJobId: jobId },
            { backendImportJobId: jobId },
        ],
    };
    const existing = await PriceListImportJob.findOne(identityFilter).lean();
    if (!existing) {
        throw { statusCode: 404, message: 'Job de importacion no encontrado' };
    }

    const allowedTransitions = {
        queued: ['running', 'completed', 'failed', 'canceled'],
        running: ['completed', 'failed', 'canceled'],
        completed: ['completed'],
        failed: ['failed'],
        canceled: ['canceled'],
    };
    const allowedNextStatuses = [
        existing.status,
        ...(allowedTransitions[existing.status] ?? []),
    ];
    if (!allowedNextStatuses.includes(status)) {
        throw {
            statusCode: 409,
            message: 'Transicion de estado invalida',
            details: {
                jobId,
                currentStatus: existing.status,
                requestedStatus: status,
                allowedNextStatuses,
            },
        };
    }

    const now = new Date();
    const update = {
        status,
        ...(summary !== undefined && { summary }),
        ...(Array.isArray(errors) && { errors }),
        ...(preview !== undefined && { preview }),
        ...(result !== undefined && { result }),
    };

    if (status === 'running') update.startedAt = now;
    if (['completed', 'failed', 'canceled'].includes(status)) update.finishedAt = now;
    if (status === 'failed') {
        update.lastError = {
            message: result?.error || details?.message || 'Error en importacion de lista de precios',
            details: details ?? result ?? null,
            at: now,
        };
    }

    const job = await PriceListImportJob.findOneAndUpdate(
        { _id: existing._id },
        { $set: update },
        { new: true }
    ).lean();

    if (status === 'failed') {
        await PriceListSettings.findOneAndUpdate(
            {},
            { $set: { lastError: update.lastError, lastImportJobId: existing.scraperJobId || existing.jobId } },
            { upsert: true, new: true, sort: { updatedAt: -1 } }
        );
    } else if (status === 'completed') {
        await PriceListSettings.findOneAndUpdate(
            {},
            { $set: { lastError: null, lastImportJobId: existing.scraperJobId || existing.jobId } },
            { upsert: true, new: true, sort: { updatedAt: -1 } }
        );
    }

    return job;
}

async function updateJobFromScraperEvent({ event, job, result, queueSnapshot, body }) {
    const scraperJobId = job?.id || body?.jobId || body?.scraperJobId;
    if (!scraperJobId) {
        throw {
            statusCode: 400,
            message: 'jobId del scraper requerido para actualizar importacion',
        };
    }

    const statusByEvent = {
        enqueued: 'queued',
        started: 'running',
        completed: 'completed',
        failed: 'failed',
        canceled: 'canceled',
    };
    const statusByPayload = {
        enqueued: 'queued',
        started: 'running',
        running: 'running',
        success: 'completed',
        completed: 'completed',
        error: 'failed',
        failed: 'failed',
        canceled: 'canceled',
    };
    const rawStatus = statusByEvent[event] || body?.status;
    const status = statusByPayload[rawStatus] || rawStatus;

    if (!status) {
        throw {
            statusCode: 400,
            message: 'Estado de importacion requerido',
            details: { event },
        };
    }

    return updateJobResult({
        jobId: scraperJobId,
        status,
        summary: result?.summary ?? body?.summary,
        errors: result?.errors ?? body?.errors,
        preview: result?.preview ?? body?.preview,
        result: result ?? body?.result,
        details: {
            event,
            queueSnapshot,
            scraperJob: job ?? null,
            payload: body,
        },
    });
}

async function getImportFileForWorker(fileId) {
    const file = await PriceListImportFile.findById(fileId).select('+buffer').lean();
    if (!file) {
        throw { statusCode: 404, message: 'Archivo temporal no encontrado' };
    }
    return file;
}

module.exports = {
    ALLOWED_EXTENSIONS,
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    getSettings,
    upsertSettings,
    getLastModified,
    createManualUploadJob,
    createConfiguredUrlJob,
    getJobs,
    getJobById,
    updateJobResult,
    updateJobFromScraperEvent,
    getImportFileForWorker,
};
