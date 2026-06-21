const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const Config = require('../models/config.model');

const CONFIG_KEY = 'priceListImport';
const TEMP_DIR = process.env.PRICE_LIST_IMPORT_TEMP_DIR
    || path.join(os.tmpdir(), 'meyfer-price-list-imports');
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000;
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

    const jobId = extractJobId(body);
    const status = body.status ?? body.event ?? null;
    const result = body.result ?? body.summary ?? body;
    const error = body.error ?? body.result?.error ?? null;

    const current = await getSettings();
    const value = normalizeSettings({
        ...current,
        lastCompletedAt: new Date(),
        lastStatus: status,
        lastError: error,
        lastScraperJobId: jobId ?? current.lastScraperJobId,
        lastResult: result,
    });

    await Config.findOneAndUpdate(
        { key: CONFIG_KEY },
        { value },
        { upsert: true, new: true }
    );

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
