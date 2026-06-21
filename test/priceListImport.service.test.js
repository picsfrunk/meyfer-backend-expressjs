const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const http = require('http');
const os = require('os');
const path = require('path');
const axios = require('axios');
const express = require('express');
const Config = require('../src/models/config.model');
const PriceListImportService = require('../src/services/price_list_import.service');
const webhookRoutes = require('../src/routes/webhooks.routes');

let configValue = null;
let postedRequests = [];
const originalAxiosPost = axios.post;
const originalFindOne = Config.findOne;
const originalFindOneAndUpdate = Config.findOneAndUpdate;

function mockLean(value) {
    return { lean: async () => value };
}

function resetMocks() {
    configValue = null;
    postedRequests = [];
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
}

test.beforeEach(resetMocks);

test.afterEach(() => {
    axios.post = originalAxiosPost;
    Config.findOne = originalFindOne;
    Config.findOneAndUpdate = originalFindOneAndUpdate;
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
