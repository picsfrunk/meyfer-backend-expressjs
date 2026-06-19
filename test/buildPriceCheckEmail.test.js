const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPriceCheckEmail } = require('../src/utils/buildPriceCheckEmail');

test('buildPriceCheckEmail renders started status as informational', () => {
    const { subject, html } = buildPriceCheckEmail({
        status: 'started',
        timestamp: '2026-06-06T12:00:00.000Z',
    });

    assert.equal(subject, 'Verificación de precios iniciada');
    assert.match(html, /La verificación de precios se inició correctamente/);
    assert.match(html, /INICIADA/);
    assert.doesNotMatch(html, /MOTIVO DEL ERROR|ERROR<\/span>/);
});

test('buildPriceCheckEmail renders queued status as informational', () => {
    const { subject, html } = buildPriceCheckEmail({
        status: 'queued',
        jobId: 'priceCheck-test-001',
        queueInfo: { position: 2, pendingAfter: 2 },
        timestamp: '2026-06-06T12:00:00.000Z',
    });

    assert.equal(subject, 'Verificación de precios en cola');
    assert.match(html, /quedó en cola para ejecutarse/);
    assert.match(html, /EN COLA/);
    assert.match(html, /priceCheck-test-001/);
    assert.doesNotMatch(html, /MOTIVO DEL ERROR|ERROR<\/span>/);
});

test('buildPriceCheckEmail keeps failed status as error', () => {
    const { subject, html } = buildPriceCheckEmail({
        status: 'failed',
        error: 'No se pudo autenticar en Odoo.',
    });

    assert.equal(subject, 'Error en la verificación de precios');
    assert.match(html, /ERROR/);
    assert.match(html, /No se pudo autenticar en Odoo/);
});
