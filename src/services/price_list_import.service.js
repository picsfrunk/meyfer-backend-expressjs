const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const Config = require('../models/config.model');
const ScraperMonitor = require('./scraper_monitor.service');
const { notifyPriceListImport } = require('./notifier.service');

const CONFIG_KEY = 'priceListImport';
const TEMP_DIR = process.env.PRICE_LIST_IMPORT_TEMP_DIR
    || path.join(os.tmpdir(), 'meyfer-price-list-imports');
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000;
const COMPLETED_STATUSES = ['completed', 'success', 'succeeded', 'done', 'finished'];
const FAILURE_STATUSES = ['failed', 'error', 'errored', 'failure'];
const CANCELED_STATUSES = ['canceled', 'cancelled'];
const ENQUEUED_STATUSES = ['enqueued', 'queued', 'pending', 'accepted'];
const RUNNING_STATUSES = ['started', 'running', 'processing'];
const ALLOWED_EXTENSIONS = ['csv', 'xlsx'];
const ALLOWED_MIME_TYPES = [
    'text/csv',
    'application/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
];

function normalizeSettings(value = {}) {
    return {
        sourceUrl: value.sourceUrl ?? null,
        lastRunAt: value.lastRunAt ?? null,
        lastCompletedAt: value.lastCompletedAt ?? null,
        lastStatus: value.lastStatus ?? null,
        lastError: value.lastError ?? null,
        lastScraperJobId: value.lastScraperJobId ?? null,
        lastSource: value.lastSource ?? null,
        lastResult: value.lastResult ?? null,
        lastPriceListImportAt: value.lastPriceListImportAt ?? null,
    };
}

async function getSettings() {
    const config = await Config.findOne({ key: CONFIG_KEY }).lean();
    return normalizeSettings(config?.value);
}

async function saveSettings(sourceUrl) {
    const normalizedUrl = validateSourceUrl(sourceUrl);
    const current = await getSettings();
    const value = normalizeSettings({ ...current, sourceUrl: normalizedUrl });

    const updated = await Config.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value },
        { upsert: true, new: true }
    ).lean();

    return normalizeSettings(updated.value);
}

async function importFromConfiguredUrl() {
    const settings = await getSettings();
    if (!settings.sourceUrl) {
        throw {
            statusCode: 400,
            message: 'No hay URL de lista de precios configurada',
        };
    }

    return enqueueImport({
        source: 'remote_configured_url',
        sourceUrl: settings.sourceUrl,
    });
}

async function importManualUpload(file) {
    if (!file) {
        throw { statusCode: 400, message: 'Archivo requerido' };
    }

    const metadata = buildFileMetadata(file);
    const fileId = await saveTemporaryFile(file.buffer, metadata);

    return enqueueImport({
        source: 'manual_upload',
        fileId,
        metadata,
    });
}

async function downloadTemporaryFile(fileId) {
    const safeFileId = validateFileId(fileId);
    const tempFile = await findTemporaryFile(safeFileId);

    if (!tempFile) {
        throw { statusCode: 404, message: 'Archivo temporal no encontrado' };
    }

    const content = await fs.readFile(tempFile.filePath);

    return {
        fileId: safeFileId,
        originalName: tempFile.originalName,
        fileName: tempFile.fileName,
        size: tempFile.size,
        mimeType: tempFile.mimeType,
        extension: tempFile.extension,
        contentBase64: content.toString('base64'),
    };
}

async function handleWebhookResult(body) {
    if (!body || typeof body !== 'object') {
        throw { statusCode: 400, message: 'Body inválido' };
    }

    const current = await getSettings();
    const normalized = normalizeWebhookPayload(body, current);

    if (!normalized.jobId && !normalized.rawStatus) {
        throw {
            statusCode: 400,
            message: 'Payload incompleto: se requiere jobId o status',
        };
    }

    const value = normalizeSettings({
        ...current,
        lastCompletedAt: normalized.isTerminal ? normalized.finishedAt : null,
        lastStatus: normalized.historyStatus,
        lastError: normalized.shouldSetError ? { message: normalized.error } : null,
        lastScraperJobId: normalized.jobId ?? current.lastScraperJobId,
        lastSource: normalized.sourceType ?? current.lastSource,
        lastResult: normalized.summary,
        ...(normalized.emailStatus === 'success'
            ? { lastPriceListImportAt: normalized.finishedAt }
            : { lastPriceListImportAt: current.lastPriceListImportAt }),
    });

    await Config.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value },
        { upsert: true, new: true }
    );

    await persistProcessHistory(normalized);
    if (shouldNotifyPriceListImport(normalized)) {
        await notifyPriceListImport(normalized);
    }

    return value;
}

async function enqueueImport(payload) {
    const scraperUrl = getScraperUrl();
    const webhookUrl = getWebhookUrl();
    const requestPayload = { ...payload, webhookUrl };

    try {
        const response = await axios.post(scraperUrl, requestPayload);
        const jobId = extractJobId(response.data);

        if (!jobId) {
            throw {
                statusCode: 502,
                message: 'El scraper no devolvió jobId',
                details: response.data,
            };
        }

        await markImportStarted({
            source: payload.source,
            scraperJobId: jobId,
        });

        return {
            jobId,
            scraperResponse: response.data,
            ...(payload.fileId && { fileId: payload.fileId }),
        };
    } catch (error) {
        if (error.statusCode) {
            await markImportFailed(error);
            throw error;
        }

        const wrapped = {
            statusCode: error.response?.status || 500,
            message: error.message || 'Error al iniciar importación de lista de precios',
            details: error.response?.data || null,
        };
        await markImportFailed(wrapped);
        throw wrapped;
    }
}

async function markImportStarted({ source, scraperJobId }) {
    const current = await getSettings();
    const value = normalizeSettings({
        ...current,
        lastRunAt: new Date(),
        lastCompletedAt: null,
        lastStatus: 'started',
        lastError: null,
        lastScraperJobId: scraperJobId,
        lastSource: source,
        lastResult: null,
    });

    await Config.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value },
        { upsert: true, new: true }
    );

    await ScraperMonitor.handleJobStarted({
        job: {
            id: scraperJobId,
            type: 'priceListImport',
            params: {
                sourceType: source,
                processName: processNameForSource(source),
            },
        },
        queueSnapshot: null,
    });
}

async function markImportFailed(error) {
    const current = await getSettings();
    const value = normalizeSettings({
        ...current,
        lastRunAt: new Date(),
        lastStatus: 'error',
        lastError: {
            message: error.message,
            details: error.details ?? null,
        },
    });

    await Config.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value },
        { upsert: true, new: true }
    );
}

function validateSourceUrl(sourceUrl) {
    if (!sourceUrl || typeof sourceUrl !== 'string') {
        throw { statusCode: 400, message: 'sourceUrl es requerida' };
    }

    try {
        const parsed = new URL(sourceUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Protocolo inválido');
        }
        return parsed.toString();
    } catch (error) {
        throw { statusCode: 400, message: 'sourceUrl inválida', details: error.message };
    }
}

function buildFileMetadata(file) {
    const originalName = file.originalname || 'price-list';
    const extension = path.extname(originalName).replace('.', '').toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw {
            statusCode: 400,
            message: 'Extensión de archivo no permitida',
            details: { extension, allowed: ALLOWED_EXTENSIONS },
        };
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw {
            statusCode: 400,
            message: 'Tipo de archivo no permitido',
            details: { mimeType: file.mimetype, allowed: ALLOWED_MIME_TYPES },
        };
    }

    return {
        originalName,
        size: file.size ?? file.buffer?.length ?? 0,
        mimeType: file.mimetype ?? 'application/octet-stream',
        extension,
    };
}

async function saveTemporaryFile(buffer, metadata) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw { statusCode: 400, message: 'Archivo vacío o inválido' };
    }

    await cleanupExpiredFiles();
    await fs.mkdir(TEMP_DIR, { recursive: true });

    const fileId = crypto.randomUUID();
    const filePath = path.join(TEMP_DIR, `${fileId}.${metadata.extension}`);
    const metadataPath = getMetadataPath(fileId);
    await fs.writeFile(filePath, buffer);
    await fs.writeFile(metadataPath, JSON.stringify({ fileId, ...metadata }, null, 2));
    return fileId;
}

async function findTemporaryFile(fileId) {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    const entries = await fs.readdir(TEMP_DIR);
    const fileName = entries.find((entry) => {
        if (!entry.startsWith(`${fileId}.`)) return false;
        const extension = path.extname(entry).replace('.', '').toLowerCase();
        return ALLOWED_EXTENSIONS.includes(extension);
    });
    if (!fileName) return null;

    const filePath = path.join(TEMP_DIR, fileName);
    const stat = await fs.stat(filePath);
    const extension = path.extname(fileName).replace('.', '').toLowerCase();
    const metadata = await readTemporaryMetadata(fileId);

    return {
        filePath,
        fileName,
        size: stat.size,
        originalName: metadata?.originalName ?? fileName,
        mimeType: metadata?.mimeType ?? mimeTypeForExtension(extension),
        extension,
    };
}

async function cleanupExpiredFiles() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        const entries = await fs.readdir(TEMP_DIR);
        const now = Date.now();

        await Promise.all(entries.map(async (entry) => {
            const filePath = path.join(TEMP_DIR, entry);
            const stat = await fs.stat(filePath);
            if (now - stat.mtimeMs > MAX_FILE_AGE_MS) {
                await fs.unlink(filePath);
            }
        }));
    } catch (error) {
        console.warn('[price-list-import] No se pudo limpiar temporales:', error.message);
    }
}

async function readTemporaryMetadata(fileId) {
    try {
        const raw = await fs.readFile(getMetadataPath(fileId), 'utf8');
        return JSON.parse(raw);
    } catch (_error) {
        return null;
    }
}

function getMetadataPath(fileId) {
    return path.join(TEMP_DIR, `${fileId}.json`);
}

function validateFileId(fileId) {
    if (!fileId || typeof fileId !== 'string' || !/^[a-f0-9-]{36}$/i.test(fileId)) {
        throw { statusCode: 400, message: 'fileId inválido' };
    }
    return fileId;
}

function getScraperUrl() {
    if (process.env.SCRAPER_PRICE_LIST_IMPORT_URL) {
        return process.env.SCRAPER_PRICE_LIST_IMPORT_URL;
    }

    if (process.env.SCRAPER_URL) {
        return `${process.env.SCRAPER_URL.replace(/\/$/, '')}/price-list-import`;
    }

    throw {
        statusCode: 503,
        message: 'SCRAPER_PRICE_LIST_IMPORT_URL no está configurada en el entorno del backend',
    };
}

function getWebhookUrl() {
    if (!process.env.WEBHOOK_PRICE_LIST_IMPORT_URL) {
        throw {
            statusCode: 503,
            message: 'WEBHOOK_PRICE_LIST_IMPORT_URL no está configurada en el entorno del backend',
        };
    }

    return process.env.WEBHOOK_PRICE_LIST_IMPORT_URL;
}

function extractJobId(payload = {}) {
    return payload.jobId ?? payload.id ?? payload.job?.id ?? null;
}

function normalizeWebhookPayload(body, currentSettings = {}) {
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    const metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const job = body.job && typeof body.job === 'object' ? body.job : {};

    const rawStatus = body.status ?? body.event ?? result.status ?? null;
    const error = extractErrorMessage(body);
    const historyStatus = normalizeHistoryStatus(rawStatus, Boolean(error));
    const emailStatus = getEmailStatus(historyStatus);
    const sourceType = normalizeSourceType(
        body.source ?? body.sourceType ?? result.source ?? result.sourceType ?? metadata.source ?? metadata.sourceType ?? job.params?.sourceType ?? currentSettings.lastSource
    );
    const summary = normalizeSummary(body);
    const finishedAt = parseDate(body.finishedAt ?? result.finishedAt ?? metadata.finishedAt ?? body.timestamp) ?? new Date();
    const startedAt = parseDate(body.startedAt ?? result.startedAt ?? metadata.startedAt ?? currentSettings.lastRunAt);
    const isTerminal = isTerminalStatus(historyStatus);

    return {
        jobId: extractJobId(body),
        rawStatus,
        historyStatus,
        emailStatus,
        status: emailStatus,
        isTerminal,
        shouldSetError: isFailureStatus(historyStatus) || Boolean(error),
        sourceType,
        processName: processNameForSource(sourceType),
        startedAt,
        finishedAt,
        completedAt: finishedAt,
        summary,
        error: error ?? (isFailureStatus(historyStatus) ? 'Error desconocido en importación de lista de precios' : null),
        errorsSummary: extractErrorsSummary(body),
    };
}

function normalizeHistoryStatus(status, hasExplicitError = false) {
    const normalized = String(status || '').toLowerCase();
    if (COMPLETED_STATUSES.includes(normalized)) return 'completed';
    if (FAILURE_STATUSES.includes(normalized)) return 'failed';
    if (CANCELED_STATUSES.includes(normalized)) return 'canceled';
    if (ENQUEUED_STATUSES.includes(normalized)) return 'enqueued';
    if (RUNNING_STATUSES.includes(normalized)) return 'running';
    if (hasExplicitError) return 'failed';
    return normalized || null;
}

function getEmailStatus(historyStatus) {
    if (historyStatus === 'completed') return 'success';
    if (isFailureStatus(historyStatus)) return 'error';
    return null;
}

function isTerminalStatus(historyStatus) {
    return ['completed', 'failed', 'canceled'].includes(historyStatus);
}

function isFailureStatus(historyStatus) {
    return ['failed', 'canceled'].includes(historyStatus);
}

function shouldNotifyPriceListImport(normalized) {
    return isTerminalStatus(normalized.historyStatus);
}

function normalizeSourceType(source) {
    if (!source) return null;
    const normalized = String(source).trim();
    const comparable = normalized.toLowerCase();
    if (['manual', 'manualupload', 'manual_upload', 'file', 'upload'].includes(comparable)) return 'manual_upload';
    if (['remote', 'url', 'configured_url', 'remote_configured_url'].includes(comparable)) return 'remote_configured_url';
    return normalized;
}

function normalizeSummary(body) {
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    const summary = body.summary && typeof body.summary === 'object'
        ? body.summary
        : (result.summary && typeof result.summary === 'object' ? result.summary : result);

    return {
        totalRows: pickNumber(summary, ['totalRows', 'total_rows', 'rowsTotal', 'total', 'rows', 'processedRows']),
        validRows: pickNumber(summary, ['validRows', 'valid_rows', 'valid', 'successfulRows']),
        updatedProducts: pickNumber(summary, ['updatedProducts', 'productsUpdated', 'updated', 'updatedCount', 'modified']),
        unchangedProducts: pickNumber(summary, ['unchangedProducts', 'productsUnchanged', 'unchanged', 'unchangedCount', 'withoutChanges']),
        notFoundProducts: pickNumber(summary, ['notFoundProducts', 'productsNotFound', 'notFound', 'not_found', 'missingProducts']),
        invalidRows: pickNumber(summary, ['invalidRows', 'invalid_rows', 'invalid', 'failedRows']),
        duplicates: pickNumber(summary, ['duplicates', 'duplicateRows', 'duplicatedRows']),
        durationMs: pickNumber(summary, ['durationMs', 'duration', 'elapsedMs']),
    };
}

async function persistProcessHistory(normalized) {
    if (!normalized.jobId) return;

    const job = {
        id: normalized.jobId,
        type: 'priceListImport',
        params: {
            sourceType: normalized.sourceType,
            processName: normalized.processName,
        },
    };

    if (normalized.historyStatus === 'enqueued') {
        await ScraperMonitor.handleJobEnqueued({ job, queueSnapshot: null });
        return;
    }

    if (normalized.historyStatus === 'running') {
        await ScraperMonitor.handleJobStarted({ job, queueSnapshot: null });
        return;
    }

    if (isTerminalStatus(normalized.historyStatus)) {
        await ScraperMonitor.handleJobFinished({
            job,
            status: normalized.historyStatus,
            result: {
                ...normalized.summary,
                error: normalized.error,
                errorsSummary: normalized.errorsSummary,
            },
            queueSnapshot: null,
        });
        return;
    }

    await ScraperMonitor.handleJobStatusReceived({
        job,
        statusReceived: normalized.historyStatus,
        result: {
            ...normalized.summary,
            error: normalized.error,
            errorsSummary: normalized.errorsSummary,
        },
        queueSnapshot: null,
    });
}

function pickNumber(source, keys) {
    for (const key of keys) {
        if (source?.[key] == null || source[key] === '') continue;
        const value = Number(source[key]);
        if (Number.isFinite(value)) return value;
    }
    return null;
}

function extractErrorMessage(body) {
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    const value = body.error ?? result.error ?? body.message ?? result.message ?? null;
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value.message) return value.message;
    try { return JSON.stringify(value); }
    catch { return String(value); }
}

function extractErrorsSummary(body) {
    const result = body.result && typeof body.result === 'object' ? body.result : {};
    const summary = body.summary && typeof body.summary === 'object'
        ? body.summary
        : (result.summary && typeof result.summary === 'object' ? result.summary : {});
    const candidates = [body.errors, result.errors, summary.errors, body.errorDetails, result.errorDetails];
    const values = candidates.find(Array.isArray) ?? [];

    return values
        .map((error) => {
            if (!error) return null;
            if (typeof error === 'string') return error;
            if (error.message) return error.message;
            try { return JSON.stringify(error); }
            catch { return String(error); }
        })
        .filter(Boolean);
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function processNameForSource(sourceType) {
    if (sourceType === 'manual_upload') return 'Actualización por lista manual';
    if (sourceType === 'remote_configured_url') return 'Actualización por lista configurada';
    return 'Importación de lista de precios';
}

function mimeTypeForExtension(extension) {
    if (extension === 'csv') return 'text/csv';
    if (extension === 'xlsx') {
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    return 'application/octet-stream';
}

module.exports = {
    getSettings,
    saveSettings,
    importFromConfiguredUrl,
    importManualUpload,
    downloadTemporaryFile,
    handleWebhookResult,
};
