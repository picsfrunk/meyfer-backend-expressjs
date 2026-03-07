const { notifyScraperDone } = require('../services/notifier.service');
const ScraperMonitor = require('../services/scraper_monitor.service');

/**
 * POST /webhooks/scraper/result
 *
 * Recibe TODOS los eventos del scraper API:
 *   - enqueued   → job encolado (hay otro corriendo)
 *   - started    → job comenzó a ejecutarse
 *   - completed  → job terminó con éxito
 *   - failed     → job terminó con error
 *
 * El campo `event` identifica el tipo. Para compatibilidad con el webhook
 * original (que no tenía `event`), si viene `status: success|error` sin
 * `event` se trata como legado y se rutea a notifyScraperDone.
 */
exports.scraperFinished = async (req, res) => {
    try {
        const body = req.body;

        // ── Validación mínima ────────────────────────────────────────────
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ message: 'Body inválido' });
        }

        // Responder rápido al scraper API para no bloquearlo
        res.status(200).json({ message: 'Webhook recibido' });

        // ── Ruteo por evento ─────────────────────────────────────────────
        const event = body.event; // 'enqueued' | 'started' | 'completed' | 'failed'

        // Siempre persistir/actualizar en la DB
        await _handleEvent(event, body);

    } catch (error) {
        console.error('[webhook.controller] Error procesando webhook de scraper:', error);
        // La respuesta ya fue enviada (200), solo loguear
    }
};

// ──────────────────────────────────────────────────────────────────────────
// HANDLER INTERNO
// ──────────────────────────────────────────────────────────────────────────

async function _handleEvent(event, body) {
    const { job, result, queueSnapshot, source, status, processed, stats, timestamp } = body;

    switch (event) {

        case 'enqueued':
            await ScraperMonitor.handleJobEnqueued({
                job,
                queueSnapshot,
                message: body.message,
            });
            console.log(`[webhook] Job encolado: ${job?.id} | En espera: ${queueSnapshot?.pending}`);
            break;

        case 'started':
            await ScraperMonitor.handleJobStarted({ job, queueSnapshot });
            console.log(`[webhook] Job iniciado: ${job?.id}`);
            break;

        case 'completed':
            await ScraperMonitor.handleJobFinished({ job, status: 'completed', result, queueSnapshot });

            // Notificación completa: actualiza last_update + envía email
            await notifyScraperDone({
                source: job?.type || source || 'scraper',
                status: 'success',
                processed: result?.processed || 0,
                stats: {
                    updatedPrices: result?.total       || 0,
                    totalErrors:   result?.errors      || 0,
                    durationMs:    result?.durationMs  || 0,
                    orphansDeleted:result?.orphansDeleted || 0,
                },
                timestamp: new Date().toISOString(),
                // Info de cola para el email enriquecido
                queueInfo: {
                    waitTimeMs:   _getWaitTime(queueSnapshot),
                    pendingAfter: queueSnapshot?.pending || 0,
                },
            });

            console.log(`[webhook] Job completado: ${job?.id}`);
            break;

        case 'failed':
            await ScraperMonitor.handleJobFinished({ job, status: 'failed', result, queueSnapshot });

            // También notificar por email cuando falla
            await notifyScraperDone({
                source: job?.type || source || 'scraper',
                status: 'error',
                processed: 0,
                stats: { totalErrors: 1, durationMs: result?.durationMs || 0 },
                timestamp: new Date().toISOString(),
            });

            console.error(`[webhook] Job fallido: ${job?.id} — ${result?.error}`);
            break;

        default:
            // ── Formato legado (sin campo `event`) ───────────────────────
            // El scraper viejo mandaba: { source, status, processed, stats, timestamp }
            if (source && status) {
                await notifyScraperDone({ source, status, processed, stats, timestamp });
                console.log(`[webhook] Evento legado procesado: ${source} → ${status}`);
            } else {
                console.warn('[webhook] Webhook recibido sin event ni formato legado reconocido:', body);
            }
    }
}

function _getWaitTime(queueSnapshot) {
    // El snapshot tiene running.elapsedMs si hay job corriendo
    return queueSnapshot?.running?.elapsedMs ?? null;
}
