const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const axios = require('axios');
const express = require('express');
const Config = require('../src/models/config.model');
const ScraperJob = require('../src/models/scraper_job.model');
const emailService = require('../src/services/email.service');
const PriceListImportService = require('../src/services/price_list_import.service');
const webhookRoutes = require('../src/routes/webhooks.routes');
const { buildPriceListImportEmail } = require('../src/utils/buildPriceListImportEmail');

let configValue = null;
let postedRequests = [];
let scraperJobs = new Map();
let sentPriceListEmails = [];
const originalAxiosPost = axios.post;
const originalFindOne = Config.findOne;
const originalFindOneAndUpdate = Config.findOneAndUpdate;
const originalScraperJobFindOne = ScraperJob.findOne;
const originalScraperJobFindOneAndUpdate = ScraperJob.findOneAndUpdate;
const originalSendPriceListImportNotification = emailService.sendPriceListImportNotification;

function mockLean(value) {
    return { lean: async () => value };
}

function resetMocks() {
    configValue = null;
    postedRequests = [];
    scraperJobs = new Map();
    sentPriceListEmails = [];
    process.env.SCRAPER_WEBHOOK_SECRET = 'shared-secret';
    process.env.SCRAPER_PRICE_LIST_IMPORT_URL = 'http://scraper.local/api/scraper/price-list-import';
    process.env.WEBHOOK_PRICE_LIST_IMPORT_URL = 'http://backend.local/api/webhook/price-list-import/result';

    Config.findOne = ({ key }) => {
        assert.equal(key, 'priceListImport');
        return mockLean(configValue ? { value: configValue } : null);
    };

    Config.findOneAndUpdate = ({ key }, update) => {
        assert.equal(key, 'priceListImport');
        configValue = update.value;
        return mockLean({ value: configValue });
    };

    axios.post = async (url, payload) => {
        postedRequests.push({ url, payload });
        return { data: { jobId: 'scraper-job-123' } };
    };

    ScraperJob.findOne = ({ jobId }) => Promise.resolve(scraperJobs.get(jobId) ?? null);
    ScraperJob.findOneAndUpdate = ({ jobId }, update) => {
        const existing = scraperJobs.get(jobId) ?? {};
        const next = {
            ...existing,
            ...(update.$setOnInsert ?? {}),
            ...(update.$set ?? {}),
            jobId,
        };
        scraperJobs.set(jobId, next);
        return Promise.resolve(next);
    };

    emailService.sendPriceListImportNotification = async (payload) => {
        sentPriceListEmails.push(payload);
        return { success: true };
    };
}

test.beforeEach(resetMocks);

test.afterEach(() => {
    axios.post = originalAxiosPost;
    Config.findOne = originalFindOne;
    Config.findOneAndUpdate = originalFindOneAndUpdate;
    ScraperJob.findOne = originalScraperJobFindOne;
    ScraperJob.findOneAndUpdate = originalScraperJobFindOneAndUpdate;
    emailService.sendPriceListImportNotification = originalSendPriceListImportNotification;
    delete process.env.SCRAPER_PRICE_LIST_IMPORT_URL;
    delete process.env.WEBHOOK_PRICE_LIST_IMPORT_URL;
    delete process.env.SCRAPER_WEBHOOK_SECRET;
});

test('saves and reads price list import settings', async () => {
    const settings = await PriceListImportService.saveSettings('https://example.com/list.xlsx');

    assert.equal(settings.sourceUrl, 'https://example.com/list.xlsx');
    assert.equal(settings.lastScraperJobId, null);

    const readBack = await PriceListImportService.getSettings();
    assert.deepEqual(readBack, settings);
});

test('manual upload stores a temporary file and calls scraper with fileId metadata', async () => {
    const result = await PriceListImportService.importManualUpload({
        originalname: 'lista.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 11,
        buffer: Buffer.from('hello world'),
    });

    assert.equal(result.jobId, 'scraper-job-123');
    assert.match(result.fileId, /^[a-f0-9-]{36}$/i);
    assert.equal(postedRequests.length, 1);
    assert.equal(postedRequests[0].url, process.env.SCRAPER_PRICE_LIST_IMPORT_URL);
    assert.deepEqual(postedRequests[0].payload, {
        source: 'manual_upload',
        fileId: result.fileId,
        metadata: {
            originalName: 'lista.xlsx',
            size: 11,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            extension: 'xlsx',
        },
        webhookUrl: process.env.WEBHOOK_PRICE_LIST_IMPORT_URL,
    });

    const tempFile = await PriceListImportService.downloadTemporaryFile(result.fileId);
    const rebuiltContent = Buffer.from(tempFile.contentBase64, 'base64').toString('utf8');

    assert.deepEqual(tempFile, {
        fileId: result.fileId,
        originalName: 'lista.xlsx',
        fileName: `${result.fileId}.xlsx`,
        size: 11,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: 'xlsx',
        contentBase64: Buffer.from('hello world').toString('base64'),
    });
    assert.equal(rebuiltContent, 'hello world');
    await removeTempFiles(result.fileId, 'xlsx');
});

test('webhook file endpoint returns JSON contentBase64 that rebuilds original file', async () => {
    const result = await PriceListImportService.importManualUpload({
        originalname: 'lista.csv',
        mimetype: 'text/csv',
        size: 17,
        buffer: Buffer.from('sku,price\n1,100\n'),
    });

    const app = express();
    app.use('/api/webhook', webhookRoutes);
    const server = await listen(app);

    try {
        const response = await fetch(
            `${server.url}/api/webhook/price-list-import/files/${result.fileId}`,
            { headers: { 'X-Webhook-Secret': 'shared-secret' } }
        );
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.equal(body.fileId, result.fileId);
        assert.equal(body.originalName, 'lista.csv');
        assert.equal(body.fileName, `${result.fileId}.csv`);
        assert.equal(body.extension, 'csv');
        assert.equal(body.mimeType, 'text/csv');
        assert.equal(Buffer.from(body.contentBase64, 'base64').toString('utf8'), 'sku,price\n1,100\n');
    } finally {
        await close(server.instance);
        await removeTempFiles(result.fileId, 'csv');
    }
});

test('manual upload rejects xls because scraper only supports csv and xlsx', async () => {
    await assert.rejects(
        () => PriceListImportService.importManualUpload({
            originalname: 'lista.xls',
            mimetype: 'application/vnd.ms-excel',
            size: 8,
            buffer: Buffer.from('content'),
        }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.message, 'Extensión de archivo no permitida');
            assert.deepEqual(error.details.allowed, ['csv', 'xlsx']);
            return true;
        }
    );

    assert.equal(postedRequests.length, 0);
});

test('import from configured URL calls scraper and returns scraper-generated jobId', async () => {
    await PriceListImportService.saveSettings('https://example.com/list.csv');

    const result = await PriceListImportService.importFromConfiguredUrl();

    assert.equal(result.jobId, 'scraper-job-123');
    assert.equal(postedRequests.length, 1);
    assert.deepEqual(postedRequests[0].payload, {
        source: 'remote_configured_url',
        sourceUrl: 'https://example.com/list.csv',
        webhookUrl: process.env.WEBHOOK_PRICE_LIST_IMPORT_URL,
    });
    assert.equal(configValue.lastScraperJobId, 'scraper-job-123');
    assert.equal(configValue.lastStatus, 'started');
    assert.equal(scraperJobs.get('scraper-job-123').type, 'priceListImport');
    assert.equal(scraperJobs.get('scraper-job-123').params.processName, 'Actualización por lista configurada');
});

test('download rejects invalid fileId before touching files', async () => {
    await assert.rejects(
        () => PriceListImportService.downloadTemporaryFile('../secret'),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.message, 'fileId inválido');
            return true;
        }
    );
});

test('scraper errors are wrapped with status and details', async () => {
    axios.post = async () => {
        const error = new Error('Request failed with status code 503');
        error.response = {
            status: 503,
            data: { message: 'scraper unavailable' },
        };
        throw error;
    };

    await PriceListImportService.saveSettings('https://example.com/list.csv');

    await assert.rejects(
        () => PriceListImportService.importFromConfiguredUrl(),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.equal(error.message, 'Request failed with status code 503');
            assert.deepEqual(error.details, { message: 'scraper unavailable' });
            return true;
        }
    );

    assert.equal(configValue.lastStatus, 'error');
    assert.equal(configValue.lastError.message, 'Request failed with status code 503');
});

test('completed webhook sends email, updates settings and registers history with normalized summary', async () => {
    configValue = {
        sourceUrl: 'https://example.com/list.csv',
        lastRunAt: new Date('2026-06-22T12:00:00.000Z'),
        lastStatus: 'started',
        lastScraperJobId: 'scraper-job-123',
        lastSource: 'remote_configured_url',
    };

    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'scraper-job-123',
        status: 'completed',
        source: 'remote_configured_url',
        finishedAt: '2026-06-22T12:10:00.000Z',
        summary: {
            total_rows: 20,
            valid_rows: 18,
            productsUpdated: 7,
            unchanged: 8,
            not_found: 2,
            invalidRows: 1,
            duplicateRows: 2,
        },
        errors: ['Fila 3 sin SKU'],
    });

    assert.equal(result.lastStatus, 'completed');
    assert.equal(result.lastSource, 'remote_configured_url');
    assert.equal(result.lastResult.totalRows, 20);
    assert.equal(result.lastResult.updatedProducts, 7);
    assert.equal(result.lastError, null);
    assert.ok(result.lastPriceListImportAt);

    assert.equal(sentPriceListEmails.length, 1);
    assert.equal(sentPriceListEmails[0].status, 'success');
    assert.equal(sentPriceListEmails[0].processName, 'Actualización por lista configurada');
    assert.equal(sentPriceListEmails[0].summary.validRows, 18);
    assert.deepEqual(sentPriceListEmails[0].errorsSummary, ['Fila 3 sin SKU']);

    const job = scraperJobs.get('scraper-job-123');
    assert.equal(job.type, 'priceListImport');
    assert.equal(job.status, 'completed');
    assert.equal(job.result.updatedProducts, 7);
    assert.equal(job.result.duplicates, 2);
    assert.equal(job.params.processName, 'Actualización por lista configurada');
});

test('failed webhook sends error email and keeps persisted result', async () => {
    configValue = {
        lastRunAt: new Date('2026-06-22T12:00:00.000Z'),
        lastStatus: 'started',
        lastScraperJobId: 'manual-job-1',
        lastSource: 'manual_upload',
    };

    await PriceListImportService.handleWebhookResult({
        job: { id: 'manual-job-1', params: { sourceType: 'manual_upload' } },
        event: 'failed',
        result: {
            error: 'No se pudo leer el archivo',
            summary: {
                totalRows: 10,
                validRows: 0,
                failedRows: 10,
            },
        },
    });

    assert.equal(configValue.lastStatus, 'failed');
    assert.equal(configValue.lastSource, 'manual_upload');
    assert.equal(configValue.lastError.message, 'No se pudo leer el archivo');
    assert.equal(configValue.lastResult.invalidRows, 10);
    assert.equal(sentPriceListEmails.length, 1);
    assert.equal(sentPriceListEmails[0].status, 'error');
    assert.equal(sentPriceListEmails[0].processName, 'Actualización por lista manual');
    assert.equal(sentPriceListEmails[0].error, 'No se pudo leer el archivo');
    assert.equal(scraperJobs.get('manual-job-1').status, 'failed');
});

test('started webhook updates running state without sending error email', async () => {
    configValue = {
        lastCompletedAt: new Date('2026-06-22T11:00:00.000Z'),
        lastPriceListImportAt: new Date('2026-06-22T11:00:00.000Z'),
        lastError: { message: 'previous error' },
    };

    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'started-job-1',
        status: 'started',
        source: 'manual_upload',
        startedAt: '2026-06-22T12:00:00.000Z',
    });

    assert.equal(result.lastStatus, 'running');
    assert.equal(result.lastCompletedAt, null);
    assert.equal(result.lastError, null);
    assert.equal(result.lastSource, 'manual_upload');
    assert.equal(sentPriceListEmails.length, 0);
    assert.equal(scraperJobs.get('started-job-1').status, 'running');
    assert.equal(scraperJobs.get('started-job-1').type, 'priceListImport');
});

test('enqueued webhook updates queued history without sending email', async () => {
    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'queued-job-1',
        status: 'queued',
        source: 'remote_configured_url',
    });

    assert.equal(result.lastStatus, 'enqueued');
    assert.equal(result.lastCompletedAt, null);
    assert.equal(result.lastError, null);
    assert.equal(sentPriceListEmails.length, 0);
    assert.equal(scraperJobs.get('queued-job-1').status, 'enqueued');
});

test('unknown webhook status without error does not send failure email', async () => {
    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'unknown-job-1',
        status: 'waiting-for-provider',
        source: 'manual_upload',
    });

    assert.equal(result.lastStatus, 'waiting-for-provider');
    assert.equal(result.lastCompletedAt, null);
    assert.equal(result.lastError, null);
    assert.equal(sentPriceListEmails.length, 0);
    assert.equal(scraperJobs.get('unknown-job-1').status, 'received');
    assert.equal(scraperJobs.get('unknown-job-1').result.statusReceived, 'waiting-for-provider');
});

test('unknown webhook status with explicit error is treated as failed and notifies error', async () => {
    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'unknown-error-job-1',
        status: 'unexpected-stop',
        source: 'remote_configured_url',
        error: 'Proveedor rechazó la lista',
    });

    assert.equal(result.lastStatus, 'failed');
    assert.equal(result.lastError.message, 'Proveedor rechazó la lista');
    assert.ok(result.lastCompletedAt);
    assert.equal(sentPriceListEmails.length, 1);
    assert.equal(sentPriceListEmails[0].status, 'error');
    assert.equal(sentPriceListEmails[0].error, 'Proveedor rechazó la lista');
    assert.equal(scraperJobs.get('unknown-error-job-1').status, 'failed');
});

test('price list import email builder does not render running status as failure', () => {
    const { subject, html } = buildPriceListImportEmail({
        jobId: 'started-job-1',
        status: 'running',
        sourceType: 'manual_upload',
        processName: 'Actualización por lista manual',
        startedAt: '2026-06-22T12:00:00.000Z',
    });

    assert.match(subject, /en proceso/);
    assert.doesNotMatch(subject, /falló/);
    assert.match(html, /EN PROCESO/);
    assert.doesNotMatch(html, /MOTIVO DEL ERROR/);
    assert.doesNotMatch(html, /Error desconocido/);
});

test('email service skips non-terminal price list import statuses', async () => {
    const result = await originalSendPriceListImportNotification({
        status: 'started',
        sourceType: 'manual_upload',
    });

    assert.deepEqual(result, {
        success: false,
        skipped: true,
        error: 'Estado no terminal, no se envía email',
    });
});

test('mail failure does not break webhook result persistence', async () => {
    emailService.sendPriceListImportNotification = async () => {
        throw new Error('mail unavailable');
    };

    const result = await PriceListImportService.handleWebhookResult({
        jobId: 'scraper-job-mail-fails',
        status: 'completed',
        source: 'manual_upload',
        summary: { totalRows: 1, updatedProducts: 1 },
    });

    assert.equal(result.lastStatus, 'completed');
    assert.equal(result.lastScraperJobId, 'scraper-job-mail-fails');
    assert.equal(scraperJobs.get('scraper-job-mail-fails').status, 'completed');
});

test('incomplete webhook payload is rejected when jobId and status are missing', async () => {
    await assert.rejects(
        () => PriceListImportService.handleWebhookResult({ summary: { totalRows: 1 } }),
        (error) => {
            assert.equal(error.statusCode, 400);
            assert.equal(error.message, 'Payload incompleto: se requiere jobId o status');
            return true;
        }
    );
});

function listen(app) {
    return new Promise((resolve) => {
        const instance = http.createServer(app);
        instance.listen(0, '127.0.0.1', () => {
            const { port } = instance.address();
            resolve({ instance, url: `http://127.0.0.1:${port}` });
        });
    });
}

function close(server) {
    return new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    });
}

async function removeTempFiles(fileId, extension) {
    const tempDir = path.join(os.tmpdir(), 'meyfer-price-list-imports');
    await Promise.allSettled([
        fs.unlink(path.join(tempDir, `${fileId}.${extension}`)),
        fs.unlink(path.join(tempDir, `${fileId}.json`)),
    ]);
}
