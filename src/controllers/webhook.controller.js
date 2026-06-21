const { notifyScraper, notifyPriceCheck } = require('../services/notifier.service');
const ScraperMonitor = require('../services/scraper_monitor.service');
const PriceListImportController = require('./price_list_import.controller');
const PriceListImportService = require('../services/price_list_import.service');

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER WEBHOOK
// Ruta real: POST /api/webhook/scraper/result
// Montaje: app.js -> /api, api.routes.js -> /webhook, webhooks.routes.js -> /scraper/result
// ─────────────────────────────────────────────────────────────────────────────

exports.scraperFinished = async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ message: 'Body inválido' });
        }

        res.status(200).json({ message: 'Webhook recibido' });
        await _handleScraperEvent(body);

    } catch (error) {
        console.error('[webhook.controller] Error procesando scraper webhook:', error);
    }
};

async function _handleScraperEvent(body) {
    const {
        event, job, result, queueSnapshot,
        // legado
        source, status, processed, stats, timestamp,
    } = body;

    console.log(`[webhook] scraper evento: ${event ?? 'legado'} | job: ${job?.id ?? '-'} | type: ${job?.type ?? '-'}`);

    if (job?.type === 'priceListImport') {
        await PriceListImportService.updateJobFromScraperEvent({
            event,
            job,
            result,
            queueSnapshot,
            body,
        });
    }

    switch (event) {

        case 'enqueued':
            await ScraperMonitor.handleJobEnqueued({ job, queueSnapshot, message: body.message });
            if (job?.type === 'priceCheck') {
                await notifyPriceCheck({
                    jobId: job?.id,
                    status: 'enqueued',
                    timestamp: new Date().toISOString(),
                    queueInfo: buildQueueInfo(queueSnapshot),
                });
            } else {
                await notifyScraper({
                    jobId:  job?.id,
                    source: job?.type || 'scraper',
                    status: 'enqueued',
                    processed: 0,
                    stats:  {},
                    timestamp: new Date().toISOString(),
                    queueInfo: buildQueueInfo(queueSnapshot),
                });
            }
            break;

        case 'started':
            await ScraperMonitor.handleJobStarted({ job, queueSnapshot });
            if (job?.type === 'priceCheck') {
                await notifyPriceCheck({
                    jobId: job?.id,
                    status: 'running',
                    timestamp: new Date().toISOString(),
                });
            } else {
                await notifyScraper({
                    jobId:  job?.id,
                    source: job?.type || 'scraper',
                    status: 'running',
                    processed: 0,
                    stats:  {},
                    timestamp: new Date().toISOString(),
                });
            }
            break;

        case 'completed':
            await ScraperMonitor.handleJobFinished({ job, status: 'completed', result, queueSnapshot });

            if (job?.type === 'priceCheck') {
                await notifyPriceCheck({
                    status:  'success',
                    summary: result?.summary ?? {},
                    changed: result?.changed ?? [],
                });
            } else {
                await notifyScraper({
                    jobId:  job?.id,
                    source: job?.type || source || 'scraper',
                    status: 'success',
                    processed: result?.processed || 0,
                    stats: {
                        updatedPrices:  result?.total          || 0,
                        totalErrors:    result?.errors         || 0,
                        durationMs:     result?.durationMs     || 0,
                        orphansDeleted: result?.orphansDeleted || 0,
                    },
                    timestamp: new Date().toISOString(),
                    queueInfo: {
                        waitTimeMs:   queueSnapshot?.running?.elapsedMs ?? null,
                        pendingAfter: queueSnapshot?.pending || 0,
                    },
                });
            }
            break;

        case 'failed':
            await ScraperMonitor.handleJobFinished({ job, status: 'failed', result, queueSnapshot });

            if (job?.type === 'priceCheck') {
                await notifyPriceCheck({
                    status: 'error',
                    error:  result?.error ?? 'Error desconocido en price check',
                });
            } else {
                await notifyScraper({
                    jobId:  job?.id,
                    source: job?.type || source || 'scraper',
                    status: 'error',
                    processed: result?.processed || 0,
                    stats: {
                        totalErrors: result?.errors || 1,
                        durationMs:  result?.durationMs || 0,
                    },
                    error:     result?.error ?? null,
                    timestamp: new Date().toISOString(),
                });
            }
            break;

        case 'canceled':
            await ScraperMonitor.handleJobCanceled({ job, queueSnapshot });

            if (job?.type === 'priceCheck') {
                await notifyPriceCheck({
                    status: 'canceled',
                });
            } else {
                await notifyScraper({
                    jobId:  job?.id,
                    source: job?.type || 'scraper',
                    status: 'canceled',
                    processed: 0,
                    stats:  {},
                    timestamp: new Date().toISOString(),
                });
            }
            break;

        default:
            if (source && status) {
                await notifyScraper({ source, status, processed, stats, timestamp });
                console.log(`[webhook] legado: ${source} → ${status}`);
            } else {
                console.warn('[webhook] Payload no reconocido:', JSON.stringify(body));
            }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICE CHECK WEBHOOK
// Ruta real: POST /api/webhook/price-check/result
// Montaje: app.js -> /api, api.routes.js -> /webhook, webhooks.routes.js -> /price-check/result
// ─────────────────────────────────────────────────────────────────────────────

exports.priceCheckFinished = async (req, res) => {
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ message: 'Body inválido' });
        }

        res.status(200).json({ message: 'Webhook recibido' });
        await _handlePriceCheckEvent(body);

    } catch (error) {
        console.error('[webhook.controller] Error procesando price check webhook:', error);
    }
};

exports.priceListImportFinished = PriceListImportController.handlePriceListImportWebhook;
exports.getPriceListImportFile = PriceListImportController.getImportFileForScraper;

async function _handlePriceCheckEvent(body) {
    const { status, summary, changed = [], error, timestamp } = body;
    const normalizedStatus = normalizePriceCheckStatus(status);
    const isError = ['error', 'failed'].includes(status);

    if (isError) {
        console.error(`[webhook] priceCheck error: ${error ?? 'Error desconocido'}`);
    } else if (['queued', 'enqueued', 'started', 'running'].includes(status)) {
        console.log(`[webhook] priceCheck ${normalizedStatus}`);
    } else {
        console.log(`[webhook] priceCheck ${normalizedStatus} — changed:${summary?.changed ?? 0} new:${summary?.new ?? 0} removed:${summary?.removed ?? 0}`);
    }

    await notifyPriceCheck({ status, summary, changed, error, timestamp });
}

function buildQueueInfo(queueSnapshot) {
    return {
        pendingAfter:   queueSnapshot?.pending ?? 0,
        waitTimeMs:     null,
        position:       queueSnapshot?.pending ?? 1,
        runningJobId:   queueSnapshot?.running?.id   ?? null,
        runningJobType: queueSnapshot?.running?.type ?? null,
        runningElapsed: queueSnapshot?.running?.elapsedMs ?? null,
    };
}

function normalizePriceCheckStatus(status) {
    if (['queued', 'enqueued'].includes(status)) return 'en cola';
    if (['started', 'running'].includes(status)) return 'iniciado';
    if (['success', 'completed'].includes(status)) return 'completado';
    if (status === 'canceled') return 'cancelado';
    return 'error';
}
