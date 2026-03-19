const { notifyScraper, notifyPriceCheck } = require('../services/notifier.service');
const ScraperMonitor = require('../services/scraper_monitor.service');

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER WEBHOOK
// POST /webhooks/scraper/result
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

    console.log(`[webhook] scraper evento: ${event ?? 'legado'} | job: ${job?.id ?? '-'}`);

    switch (event) {

        case 'enqueued':
            await ScraperMonitor.handleJobEnqueued({ job, queueSnapshot, message: body.message });
            await notifyScraper({
                jobId:  job?.id,
                source: job?.type || 'scraper',
                status: 'enqueued',
                processed: 0,
                stats:  {},
                timestamp: new Date().toISOString(),
                queueInfo: {
                    pendingAfter:   queueSnapshot?.pending ?? 0,
                    waitTimeMs:     null,
                    position:       queueSnapshot?.pending ?? 1,
                    runningJobId:   queueSnapshot?.running?.id   ?? null,
                    runningJobType: queueSnapshot?.running?.type ?? null,
                    runningElapsed: queueSnapshot?.running?.elapsedMs ?? null,
                },
            });
            break;

        case 'started':
            await ScraperMonitor.handleJobStarted({ job, queueSnapshot });
            await notifyScraper({
                jobId:  job?.id,
                source: job?.type || 'scraper',
                status: 'running',
                processed: 0,
                stats:  {},
                timestamp: new Date().toISOString(),
            });
            break;

        case 'completed':
            await ScraperMonitor.handleJobFinished({ job, status: 'completed', result, queueSnapshot });
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
            break;

        case 'failed':
            await ScraperMonitor.handleJobFinished({ job, status: 'failed', result, queueSnapshot });
            await notifyScraper({
                jobId:  job?.id,
                source: job?.type || source || 'scraper',
                status: 'error',
                processed: 0,
                stats: { totalErrors: 1, durationMs: result?.durationMs || 0 },
                timestamp: new Date().toISOString(),
            });
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
// POST /webhooks/price-check/result
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

async function _handlePriceCheckEvent(body) {
    const { status, summary, changed = [], error, timestamp } = body;

    await notifyPriceCheck({ status, summary, changed, error, timestamp });
}
