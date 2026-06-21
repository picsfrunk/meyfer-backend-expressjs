const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const axios = require('axios');
const Config = require('../src/models/config.model');
const PriceListImportService = require('../src/services/price_list_import.service');

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
    const content = await fs.readFile(tempFile.filePath, 'utf8');

    assert.equal(tempFile.mimeType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(content, 'hello world');
    await fs.unlink(tempFile.filePath);
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
