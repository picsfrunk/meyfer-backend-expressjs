const { notifyScraperDone } = require('../services/notifier.service');
const ScraperMonitor = require('../services/scraper_monitor.service');

/**
 * POST /webhooks/scraper/result
 *
 * Recibe todos los eventos del scraper API:
 *   - enqueued   → job encolado (hay otro corriendo)
 *   - started    → job comenzó a ejecutarse
 *   - completed  → job terminó con éxito
 *   - failed     → job terminó con error
 *
 * Formato esperado (modo cola):
 * {
 *   event: 'started',
 *   job: { id, type },
 *   queueSnapshot: { isRunning, running, pending, pendingJobs },
 *   result: { total, processed, errors, ... },  // solo en completed/failed
 *   source: 'scraperQueue',
 *   status: 'started',
 *   timestamp: '...'
 * }
 *
 * Formato legado (sin event):
 * { source, status, processed, stats, timestamp }
 */
exports.scraperFinished = async (req, res) => {
    try {
        const body = req.body;

        if (!body || typeof body !== 'object') {
            return res.status(400).json({ message: 'Body inválido' });
        }

        // Responder rápido al scraper API para no bloquearlo
        res.status(200).json({ message: 'Webhook recibido' });

        await _handleEvent(body);

    } catch (error) {
        console.error('[webhook.controller] Error procesando webhook:', error);
    }
};

async function _handleEvent(body) {
    const {
        event,
        job,
        result,
        queueSnapshot,
        // legado
        source,
        status,
        processed,
        stats,
        timestamp,
    } = body;

    console.log(`[webhook] Evento recibido: ${event ?? 'legado'} | job: ${job?.id ?? '-'}`);

    switch (event) {

        case 'enqueued':
            await ScraperMonitor.handleJobEnqueued({ job, queueSnapshot, message: body.message });
            break;

        case 'started':
            await ScraperMonitor.handleJobStarted({ job, queueSnapshot });
            break;

        case 'completed':
            await ScraperMonitor.handleJobFinished({ job, status: 'completed', result, queueSnapshot });

            await notifyScraperDone({
                source:    job?.type || source || 'scraper',
                status:    'success',
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

            await notifyScraperDone({
                source:    job?.type || source || 'scraper',
                status:    'error',
                processed: 0,
                stats: { totalErrors: 1, durationMs: result?.durationMs || 0 },
                timestamp: new Date().toISOString(),
            });
            break;

        default:
            // ── Formato legado ────────────────────────────────────────────
            if (source && status) {
                await notifyScraperDone({ source, status, processed, stats, timestamp });
                console.log(`[webhook] Evento legado: ${source} → ${status}`);
            } else {
                console.warn('[webhook] Payload no reconocido:', JSON.stringify(body));
            }
    }
}
