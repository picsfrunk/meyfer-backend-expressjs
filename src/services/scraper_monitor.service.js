const axios = require('axios');
const ScraperJob = require('../models/scraper_job.model');

// ──────────────────────────────────────────────────────────────────────────
// ESTADO LIVE (en memoria, refleja lo que informa el scraper API)
// Se sincroniza con cada webhook recibido.
// ──────────────────────────────────────────────────────────────────────────

let _liveSnapshot = {
    isRunning: false,
    running: null,
    pending: 0,
    pendingJobs: [],
    lastSyncAt: null,
};

function updateLiveSnapshot(queueSnapshot) {
    if (!queueSnapshot) return;
    _liveSnapshot = {
        ...queueSnapshot,
        lastSyncAt: new Date().toISOString(),
    };
}

// ──────────────────────────────────────────────────────────────────────────
// HANDLERS DE WEBHOOKS — llamados desde webhook.controller
// ──────────────────────────────────────────────────────────────────────────

/**
 * Job recién encolado (hay otro corriendo).
 */
async function handleJobEnqueued({ job, queueSnapshot, message }) {
    updateLiveSnapshot(queueSnapshot);

    await ScraperJob.findOneAndUpdate(
        { jobId: job.id },
        {
            $setOnInsert: {
                jobId: job.id,
                type: job.type,
                status: 'enqueued',
                queuePosition: queueSnapshot?.pending ?? 0,
                pendingAtEnqueue: queueSnapshot?.pending ?? 0,
                enqueuedAt: new Date(),
                lastQueueSnapshot: queueSnapshot,
                params: job.params ?? null,
            }
        },
        { upsert: true, new: true }
    );
}

/**
 * Job comenzó a ejecutarse.
 */
async function handleJobStarted({ job, queueSnapshot }) {
    updateLiveSnapshot(queueSnapshot);

    const now = new Date();

    await ScraperJob.findOneAndUpdate(
        { jobId: job.id },
        {
            $set: {
                status: 'running',
                startedAt: now,
                lastQueueSnapshot: queueSnapshot,
            },
            // Si el job arrancó directo (sin encolarse), aseguramos que exista el doc
            $setOnInsert: {
                jobId: job.id,
                type: job.type,
                enqueuedAt: now,
                queuePosition: 0,
                pendingAtEnqueue: 0,
                params: job.params ?? null,
            }
        },
        { upsert: true, new: true }
    );
}

/**
 * Job cancelado (desde la API o por señal graceful).
 */
async function handleJobCanceled({ job, queueSnapshot }) {
    updateLiveSnapshot(queueSnapshot);

    const now = new Date();

    const existing = await ScraperJob.findOne({ jobId: job.id });
    const startedAt  = existing?.startedAt  ?? null;
    const enqueuedAt = existing?.enqueuedAt ?? now;

    const durationMs = startedAt ? (now - startedAt) : null;
    const waitTimeMs = startedAt ? (startedAt - enqueuedAt) : null;

    await ScraperJob.findOneAndUpdate(
        { jobId: job.id },
        {
            $set: {
                status: 'canceled',
                finishedAt: now,
                ...(durationMs != null && { durationMs }),
                ...(waitTimeMs != null && { waitTimeMs }),
                lastQueueSnapshot: queueSnapshot,
            },
            $setOnInsert: {
                jobId: job.id,
                type: job.type,
                enqueuedAt: now,
                queuePosition: 0,
                pendingAtEnqueue: 0,
                params: job.params ?? null,
            }
        },
        { upsert: true, new: true }
    );
}

/**
 * Job completado o fallido.
 */
async function handleJobFinished({ job, status, result, queueSnapshot }) {
    updateLiveSnapshot(queueSnapshot);

    const now = new Date();

    const existing = await ScraperJob.findOne({ jobId: job.id });
    const startedAt = existing?.startedAt ?? now;
    const enqueuedAt = existing?.enqueuedAt ?? now;

    const durationMs = now - startedAt;
    const waitTimeMs = startedAt - enqueuedAt;

    await ScraperJob.findOneAndUpdate(
        { jobId: job.id },
        {
            $set: {
                status,                         // 'completed' | 'failed'
                finishedAt: now,
                durationMs,
                waitTimeMs,
                result: _normalizeResult(result, job?.type),
                lastQueueSnapshot: queueSnapshot,
            },
            $setOnInsert: {
                jobId: job.id,
                type: job.type,
                enqueuedAt: now,
                startedAt: now,
                queuePosition: 0,
                pendingAtEnqueue: 0,
            }
        },
        { upsert: true, new: true }
    );
}

function _normalizeResult(result = {}, jobType = null) {
    // Price check tiene una estructura de resultado diferente al scraper
    if (jobType === 'priceCheck' || result?.summary) {
        return {
            // Campos de price check
            summary:       result.summary       ?? null,
            changedCount:  result.summary?.changed   ?? result.changed?.length  ?? null,
            newCount:      result.summary?.new        ?? result.new?.length      ?? null,
            removedCount:  result.summary?.removed    ?? result.removed?.length  ?? null,
            failedCount:   result.summary?.failed     ?? null,
            durationMs:    result.summary?.durationMs ?? result.durationMs       ?? null,
            error:         result.error          ?? null,
        };
    }

    // Scraper estándar
    return {
        total:          result.total          ?? null,
        processed:      result.processed      ?? null,
        errors:         result.errors         ?? result.totalErrors ?? null,
        uploaded:       result.uploaded       ?? null,
        orphansDeleted: result.orphansDeleted ?? null,
        durationMs:     result.durationMs     ?? null,
        error:          result.error          ?? null,
    };
}

// ──────────────────────────────────────────────────────────────────────────
// CONSULTAS — usadas por el controller del front admin
// ──────────────────────────────────────────────────────────────────────────

/**
 * Estado live de la cola (snapshot en memoria + fallback a scraper API).
 */
async function getLiveStatus() {
    // Si el snapshot tiene menos de 30s, lo devolvemos directo
    if (_liveSnapshot.lastSyncAt) {
        const ageMs = Date.now() - new Date(_liveSnapshot.lastSyncAt).getTime();
        if (ageMs < 30_000) return _liveSnapshot;
    }

    // Fallback: consultar al scraper API directamente
    try {
        const url = process.env.SCRAPER_STATUS_URL; // ej: http://scraper-api/scraper/status
        if (url) {
            const { data } = await axios.get(url, { timeout: 5000 });
            updateLiveSnapshot(data);
            return _liveSnapshot;
        }
    } catch (err) {
        console.warn('[scraper_monitor] No se pudo contactar al scraper API:', err.message);
    }

    return _liveSnapshot;
}

/**
 * Historial paginado de jobs.
 */
async function getJobHistory({ page = 1, limit = 20, status = null, type = null } = {}) {
    const filter = {};
    if (status) filter.status = status;
    if (type)   filter.type   = type;

    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
        ScraperJob.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        ScraperJob.countDocuments(filter),
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        jobs,
    };
}

/**
 * Detalle de un job específico.
 */
async function getJobById(jobId) {
    return ScraperJob.findOne({ jobId }).lean();
}

/**
 * Stats resumidas para el dashboard admin.
 */
async function getDashboardStats() {
    const [total, running, failed, completed] = await Promise.all([
        ScraperJob.countDocuments(),
        ScraperJob.countDocuments({ status: 'running' }),
        ScraperJob.countDocuments({ status: 'failed' }),
        ScraperJob.countDocuments({ status: 'completed' }),
    ]);

    const lastCompleted = await ScraperJob.findOne({ status: 'completed' })
        .sort({ finishedAt: -1 })
        .lean();

    const avgDuration = await ScraperJob.aggregate([
        { $match: { status: 'completed', durationMs: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$durationMs' } } },
    ]);

    return {
        total,
        running,
        failed,
        completed,
        enqueued: await ScraperJob.countDocuments({ status: 'enqueued' }),
        lastCompletedAt: lastCompleted?.finishedAt ?? null,
        avgDurationMs: avgDuration[0]?.avg ?? null,
    };
}

const cancelJobById = async (jobId) => {
    try {
        const response = await axios.delete(
            `${process.env.SCRAPER_URL}/jobs/${jobId}`
        );

        return {
            ...response.data,
            httpStatus: response.status
        };
    } catch (error) {
        if (error.response) {
            return {
                ...error.response.data,
                httpStatus: error.response.status
            };
        }

        throw error;
    }
};

// NUEVO
const cancelAllPendingJobs = async () => {
    const response = await axios.delete(
        `${process.env.SCRAPER_URL}/jobs/all`
    );

    return response.data;
};

module.exports = {
    // Webhook handlers
    handleJobEnqueued,
    handleJobStarted,
    handleJobFinished,
    handleJobCanceled,
    // Queries
    getLiveStatus,
    getJobHistory,
    getJobById,
    getDashboardStats,
    // Jobs Manager
    cancelJobById,
    cancelAllPendingJobs
};
