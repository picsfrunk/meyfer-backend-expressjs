const test = require('node:test');
const assert = require('node:assert/strict');
const { authenticateWebhook } = require('../src/middlewares/webhookAuth.middleware');

function createMockResponse() {
    return {
        statusCode: null,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

function createMockRequest(headerValue) {
    return {
        get(headerName) {
            assert.equal(headerName, 'X-Webhook-Secret');
            return headerValue;
        },
    };
}

test('rejects request without webhook secret header', () => {
    process.env.SCRAPER_WEBHOOK_SECRET = 'shared-secret';
    const res = createMockResponse();
    let nextCalled = false;

    authenticateWebhook(createMockRequest(undefined), res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('rejects request with invalid webhook secret header', () => {
    process.env.SCRAPER_WEBHOOK_SECRET = 'shared-secret';
    const res = createMockResponse();
    let nextCalled = false;

    authenticateWebhook(createMockRequest('wrong'), res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
});

test('allows request with valid webhook secret header', () => {
    process.env.SCRAPER_WEBHOOK_SECRET = 'shared-secret';
    const res = createMockResponse();
    let nextCalled = false;

    authenticateWebhook(createMockRequest('shared-secret'), res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, null);
    assert.equal(nextCalled, true);
});

test('fails closed when webhook secret env is missing', () => {
    delete process.env.SCRAPER_WEBHOOK_SECRET;
    const res = createMockResponse();
    let nextCalled = false;

    authenticateWebhook(createMockRequest('shared-secret'), res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 503);
    assert.equal(nextCalled, false);
});
