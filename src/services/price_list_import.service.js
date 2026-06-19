const crypto = require('crypto');
const path = require('path');
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
    const jobId = generateJobId();
    const now = new Date();

    const importFile = await PriceListImportFile.create({
        originalName: file.originalname,
        mimeType: file.mimetype || null,
        extension,
        size: file.size,
        buffer: file.buffer,
        uploadedAt: now,
        uploadedBy: actor,
        importJobId: jobId,
        expiresAt: new Date(now.getTime() + FILE_TTL_MS),
    });

    let job;
    try {
        job = await PriceListImportJob.create({
            jobId,
            type: 'price-list-import',
            source: 'manual_upload',
            status: 'queued',
            fileId: importFile._id,
            queuedAt: now,
            requestedBy: actor,
            metadata: {
                originalName: file.originalname,
                mimeType: file.mimetype || null,
                size: file.size,
                extension,
            },
        });
    } catch (error) {
        await PriceListImportFile.deleteOne({ _id: importFile._id });
        throw error;
    }

    await PriceListSettings.findOneAndUpdate(
        {},
        { $set: { lastImportJobId: jobId, lastError: null } },
        { upsert: true, new: true, sort: { updatedAt: -1 } }
    );

    return {
        job: job.toObject(),
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
}

async function getNextJobForWorker({ status = 'queued' } = {}) {
    if (status !== 'queued') {
        throw {
            statusCode: 400,
            message: 'Solo se puede consultar el proximo job queued',
            details: { status },
        };
    }

    return PriceListImportJob.findOne({ status: 'queued' })
        .sort({ queuedAt: 1 })
        .lean();
}

async function claimJobForWorker(jobId) {
    const now = new Date();
    const job = await PriceListImportJob.findOneAndUpdate(
        { jobId, status: 'queued' },
        {
            $set: {
                status: 'running',
                startedAt: now,
            },
        },
        { new: true }
    ).lean();

    if (job) return job;

    const existing = await PriceListImportJob.findOne({ jobId }).lean();
    if (!existing) {
        throw { statusCode: 404, message: 'Job de importacion no encontrado' };
    }

    throw {
        statusCode: 409,
        message: 'El job ya no esta queued',
        details: { jobId, currentStatus: existing.status },
    };
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

    const jobId = generateJobId();
    const job = await PriceListImportJob.create({
        jobId,
        type: 'price-list-import',
        source: 'remote_configured_url',
        status: 'queued',
        sourceUrl: settings.priceListUrl,
        queuedAt: new Date(),
        requestedBy: getActor(user),
    });

    await PriceListSettings.findByIdAndUpdate(settings._id, {
        $set: {
            lastImportJobId: jobId,
            lastError: null,
        },
    });

    return job.toObject();
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
    const job = await PriceListImportJob.findOne({ jobId }).lean();
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

    const existing = await PriceListImportJob.findOne({ jobId }).lean();
    if (!existing) {
        throw { statusCode: 404, message: 'Job de importacion no encontrado' };
    }

    const allowedTransitions = {
        queued: ['running', 'canceled'],
        running: ['completed', 'failed', 'canceled'],
    };
    const allowedNextStatuses = allowedTransitions[existing.status] ?? [];
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
        { jobId },
        { $set: update },
        { new: true }
    ).lean();

    if (status === 'failed') {
        await PriceListSettings.findOneAndUpdate(
            {},
            { $set: { lastError: update.lastError, lastImportJobId: jobId } },
            { upsert: true, new: true, sort: { updatedAt: -1 } }
        );
    } else if (status === 'completed') {
        await PriceListSettings.findOneAndUpdate(
            {},
            { $set: { lastError: null, lastImportJobId: jobId } },
            { upsert: true, new: true, sort: { updatedAt: -1 } }
        );
    }

    return job;
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
    getNextJobForWorker,
    claimJobForWorker,
    updateJobResult,
    getImportFileForWorker,
};
