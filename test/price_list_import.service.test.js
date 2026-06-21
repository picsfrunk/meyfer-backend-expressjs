const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const PriceListImportService = require('../src/services/price_list_import.service');
const PriceListImportFile = require('../src/models/price_list_import_file.model');
const PriceListImportJob = require('../src/models/price_list_import_job.model');
const PriceListSettings = require('../src/models/price_list_settings.model');

const originalAxiosPost = axios.post;
const originalFileCreate = PriceListImportFile.create;
const originalFileDeleteOne = PriceListImportFile.deleteOne;
const originalFileFindById = PriceListImportFile.findById;
const originalJobCreate = PriceListImportJob.create;
const originalSettingsFindOne = PriceListSettings.findOne;
const originalSettingsFindOneAndUpdate = PriceListSettings.findOneAndUpdate;
const originalSettingsFindByIdAndUpdate = PriceListSettings.findByIdAndUpdate;

const originalEnv = {
    PRICE_LIST_IMPORT_SCRAPER_URL: process.env.PRICE_LIST_IMPORT_SCRAPER_URL,
    WEBHOOK_PRICE_LIST_IMPORT_URL: process.env.WEBHOOK_PRICE_LIST_IMPORT_URL,
    WEBHOOK_URL: process.env.WEBHOOK_URL,
    SCRAPER_URL: process.env.SCRAPER_URL,
    SCRAPER_API_URL: process.env.SCRAPER_API_URL,
    SCRAPER_BASE_URL: process.env.SCRAPER_BASE_URL,
};

test.afterEach(() => {
    axios.post = originalAxiosPost;
    PriceListImportFile.create = originalFileCreate;
    PriceListImportFile.deleteOne = originalFileDeleteOne;
    PriceListImportFile.findById = originalFileFindById;
    PriceListImportJob.create = originalJobCreate;
    PriceListSettings.findOne = originalSettingsFindOne;
    PriceListSettings.findOneAndUpdate = originalSettingsFindOneAndUpdate;
    PriceListSettings.findByIdAndUpdate = originalSettingsFindByIdAndUpdate;

    for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
});

function configureScraperEnv() {
    process.env.PRICE_LIST_IMPORT_SCRAPER_URL = 'https://scraper.example/api/scraper/price-list-import';
    process.env.WEBHOOK_PRICE_LIST_IMPORT_URL = 'https://backend.example/api/webhook/price-list-import/result';
    delete process.env.WEBHOOK_URL;
    delete process.env.SCRAPER_URL;
    delete process.env.SCRAPER_API_URL;
    delete process.env.SCRAPER_BASE_URL;
}

function createUploadFile() {
    return {
        originalname: 'lista.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1234,
        buffer: Buffer.from('xlsx-content'),
    };
}

function stubJobCreate(assertCall) {
    PriceListImportJob.create = async (payload) => {
        assertCall(payload);
        return {
            toObject: () => ({ _id: 'job-doc-id', ...payload }),
        };
    };
}

test('manual upload stores temporary file, calls scraper and returns scraperJobId', async () => {
    configureScraperEnv();
    let deletedTemporaryFile = false;
    let settingsUpdatedWithJobId = null;

    PriceListImportFile.create = async (payload) => ({
        _id: 'file_123',
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        size: payload.size,
        uploadedAt: payload.uploadedAt,
        importJobId: payload.importJobId,
        expiresAt: payload.expiresAt,
    });
    PriceListImportFile.deleteOne = async () => {
        deletedTemporaryFile = true;
    };
    axios.post = async (url, body) => {
        assert.equal(url, process.env.PRICE_LIST_IMPORT_SCRAPER_URL);
        assert.equal(body.source, 'manual_upload');
        assert.equal(body.fileId, 'file_123');
        assert.equal(body.webhookUrl, process.env.WEBHOOK_PRICE_LIST_IMPORT_URL);
        assert.match(body.backendImportJobId, /^pli_/);
        assert.equal(body.requestId, body.backendImportJobId);
        assert.deepEqual(body.metadata, {
            originalName: 'lista.xlsx',
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            size: 1234,
            extension: '.xlsx',
        });
        return { data: { status: 'accepted', jobId: 'priceListImport-123' } };
    };
    stubJobCreate((payload) => {
        assert.equal(payload.jobId, 'priceListImport-123');
        assert.equal(payload.scraperJobId, 'priceListImport-123');
        assert.match(payload.backendImportJobId, /^pli_/);
        assert.equal(payload.status, 'queued');
        assert.equal(payload.fileId, 'file_123');
    });
    PriceListSettings.findOneAndUpdate = async (_filter, update) => {
        settingsUpdatedWithJobId = update.$set.lastImportJobId;
    };

    const result = await PriceListImportService.createManualUploadJob({
        file: createUploadFile(),
        user: { username: 'admin' },
    });

    assert.equal(result.scraperJobId, 'priceListImport-123');
    assert.equal(result.job.jobId, 'priceListImport-123');
    assert.equal(settingsUpdatedWithJobId, 'priceListImport-123');
    assert.equal(result.file.id, 'file_123');
    assert.equal(deletedTemporaryFile, false);
});

test('configured URL import calls scraper and returns scraperJobId', async () => {
    configureScraperEnv();
    const settings = {
        _id: 'settings-id',
        priceListUrl: 'https://files.example/lista.csv',
    };
    let settingsUpdatedWithJobId = null;

    PriceListSettings.findOne = () => ({
        sort: () => ({
            lean: async () => settings,
        }),
    });
    axios.post = async (url, body) => {
        assert.equal(url, process.env.PRICE_LIST_IMPORT_SCRAPER_URL);
        assert.equal(body.source, 'remote_configured_url');
        assert.equal(body.sourceUrl, settings.priceListUrl);
        assert.equal(body.webhookUrl, process.env.WEBHOOK_PRICE_LIST_IMPORT_URL);
        assert.match(body.backendImportJobId, /^pli_/);
        assert.equal(body.requestId, body.backendImportJobId);
        return { data: { success: true, status: 'accepted', jobId: 'priceListImport-456' } };
    };
    stubJobCreate((payload) => {
        assert.equal(payload.jobId, 'priceListImport-456');
        assert.equal(payload.scraperJobId, 'priceListImport-456');
        assert.equal(payload.source, 'remote_configured_url');
        assert.equal(payload.sourceUrl, settings.priceListUrl);
    });
    PriceListSettings.findByIdAndUpdate = async (id, update) => {
        assert.equal(id, settings._id);
        settingsUpdatedWithJobId = update.$set.lastImportJobId;
    };

    const job = await PriceListImportService.createConfiguredUrlJob({
        user: { username: 'admin' },
    });

    assert.equal(job.scraperJobId, 'priceListImport-456');
    assert.equal(job.jobId, 'priceListImport-456');
    assert.equal(settingsUpdatedWithJobId, 'priceListImport-456');
});

test('manual upload returns clear error and removes temporary file when scraper fails', async () => {
    configureScraperEnv();
    let deletedFilter = null;

    PriceListImportFile.create = async (payload) => ({
        _id: 'file_500',
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        size: payload.size,
        uploadedAt: payload.uploadedAt,
        importJobId: payload.importJobId,
        expiresAt: payload.expiresAt,
    });
    PriceListImportFile.deleteOne = async (filter) => {
        deletedFilter = filter;
    };
    axios.post = async () => {
        const error = new Error('Request failed with status code 503');
        error.response = { status: 503, data: { message: 'scraper unavailable' } };
        throw error;
    };
    PriceListImportJob.create = async () => {
        throw new Error('job history should not be created when scraper rejects the request');
    };

    await assert.rejects(
        () => PriceListImportService.createManualUploadJob({
            file: createUploadFile(),
            user: { username: 'admin' },
        }),
        (error) => {
            assert.equal(error.statusCode, 503);
            assert.deepEqual(error.details, { message: 'scraper unavailable' });
            return true;
        }
    );

    assert.deepEqual(deletedFilter, { _id: 'file_500' });
});

test('temporary import file remains readable for scraper by fileId', async () => {
    const storedFile = {
        _id: 'file_readable',
        originalName: 'lista.csv',
        mimeType: 'text/csv',
        extension: '.csv',
        size: 12,
        uploadedAt: new Date('2026-01-01T00:00:00.000Z'),
        importJobId: 'pli_trace',
        expiresAt: new Date('2026-01-08T00:00:00.000Z'),
        buffer: Buffer.from('sku,price\n1,10'),
    };

    PriceListImportFile.findById = (fileId) => {
        assert.equal(fileId, 'file_readable');
        return {
            select: (projection) => {
                assert.equal(projection, '+buffer');
                return {
                    lean: async () => storedFile,
                };
            },
        };
    };

    const file = await PriceListImportService.getImportFileForWorker('file_readable');

    assert.equal(file._id, 'file_readable');
    assert.equal(file.buffer.toString('utf8'), 'sku,price\n1,10');
});
