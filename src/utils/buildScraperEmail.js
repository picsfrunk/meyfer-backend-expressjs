/**
 * buildScraperEmail.js
 *
 * Genera el HTML del email de reporte de scraper.
 * Separado del service para mantener el código limpio y facilitar cambios visuales.
 *
 * @param {object} payload
 * @param {string}  payload.source        - Tipo de scraper (sitemapScraper, categoryScraper, etc.)
 * @param {string}  payload.status        - 'success' | 'error' | 'enqueued' | 'running' | 'canceled'
 * @param {number}  payload.processed     - Cantidad de productos procesados
 * @param {object}  payload.stats         - Estadísticas del run
 * @param {string}  payload.timestamp     - ISO timestamp de finalización
 * @param {object}  [payload.queueInfo]   - Info de cola (opcional)
 * @returns {{ subject: string, html: string }}
 */
function buildScraperEmail(payload = {}) {
    const {
        jobId     = null,
        source,
        status,
        processed = 0,
        stats = {},
        timestamp,
        queueInfo = null,
        error     = null,
    } = payload;

    const {
        updatedPrices  = 0,
        totalErrors    = 0,
        durationMs     = 0,
        orphansDeleted = 0,
    } = stats;

    // ── Configuración visual por estado ─────────────────────────────────
    const STATE = {
        success: {
            emoji:       '✅',
            label:       'Completado',
            headerColor: '#1a7f4b',
            headerBg:    '#eafaf1',
            badgeBg:     '#d4efdf',
            badgeColor:  '#1a7f4b',
            badgeBorder: '#a9dfbf',
        },
        error: {
            emoji:       '❌',
            label:       'Falló',
            headerColor: '#a93226',
            headerBg:    '#fdedec',
            badgeBg:     '#fadbd8',
            badgeColor:  '#a93226',
            badgeBorder: '#f1948a',
        },
        enqueued: {
            emoji:       '⏳',
            label:       'En cola',
            headerColor: '#7d6608',
            headerBg:    '#fef9e7',
            badgeBg:     '#fdebd0',
            badgeColor:  '#7d6608',
            badgeBorder: '#f8c471',
        },
        running: {
            emoji:       '⚙️',
            label:       'En ejecución',
            headerColor: '#1a5276',
            headerBg:    '#eaf4fb',
            badgeBg:     '#d6eaf8',
            badgeColor:  '#1a5276',
            badgeBorder: '#85c1e9',
        },
        canceled: {
            emoji:       '🚫',
            label:       'Cancelado',
            headerColor: '#566573',
            headerBg:    '#f2f3f4',
            badgeBg:     '#ebedef',
            badgeColor:  '#566573',
            badgeBorder: '#d5dbdb',
        },
    };

    const s = STATE[status] ?? STATE.error;

    // ── Helpers ──────────────────────────────────────────────────────────
    const formatMs = (ms) => {
        if (!ms) return '—';
        const sec = Math.floor(ms / 1000);
        const min = Math.floor(sec / 60);
        const hrs = Math.floor(min / 60);
        if (hrs > 0) return `${hrs}h ${min % 60}m ${sec % 60}s`;
        if (min > 0) return `${min}m ${sec % 60}s`;
        return `${sec}s`;
    };

    const formatDate = (ts) => {
        try { return new Date(ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' }); }
        catch { return ts ?? '—'; }
    };

    const sourceLabel = {
        sitemapScraper:  'Scraper por Sitemap',
        categoryScraper: 'Scraper por Categoría',
        sitemapAnalysis: 'Análisis de Sitemap',
        priceCheck:      'Verificación de Precios',
        scraperQueue:    'Cola de Scraper',   // fallback si llega source legado
    }[source] ?? (source ? source : 'Scraper');

    // ── Fila de tabla helper ─────────────────────────────────────────────
    const row = (label, value, opts = {}) => {
        const { valueColor = '#2c3e50', bg = 'transparent', bold = false } = opts;
        return `
        <tr style="background:${bg};">
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:#566573;font-size:13px;">${label}</td>
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:${valueColor};font-size:13px;${bold ? 'font-weight:700;' : ''}">${value}</td>
        </tr>`;
    };

    // ── Sección de cola ──────────────────────────────────────────────────
    const queueSection = queueInfo ? `
        <tr>
            <td colspan="2" style="padding:10px 14px;border:1px solid #e5e8e8;background:#eaf4fb;font-size:12px;font-weight:700;color:#1a5276;letter-spacing:0.5px;">
                📋 ESTADO DE COLA
            </td>
        </tr>
        ${row(
        'Jobs pendientes tras finalizar',
        `<span style="background:${queueInfo.pendingAfter > 0 ? '#fdebd0' : '#eafaf1'};
                color:${queueInfo.pendingAfter > 0 ? '#d35400' : '#1a7f4b'};
                padding:2px 10px;border-radius:12px;font-weight:700;">
                ${queueInfo.pendingAfter > 0 ? `${queueInfo.pendingAfter} en espera` : 'Cola vacía'}
            </span>`,
    )}
        ${queueInfo.waitTimeMs != null ? row('Tiempo esperando en cola', formatMs(queueInfo.waitTimeMs), { bg: '#f8f9fa' }) : ''}
    ` : '';

    // ── Errores: badge o cero ────────────────────────────────────────────
    const errorsValue = totalErrors > 0
        ? `<span style="background:#fadbd8;color:#a93226;padding:2px 10px;border-radius:12px;font-weight:700;">${totalErrors} errores</span>`
        : `<span style="color:#1a7f4b;font-weight:600;">0</span>`;

    const orphansValue = orphansDeleted > 0
        ? `<span style="background:#fdebd0;color:#d35400;padding:2px 10px;border-radius:12px;font-weight:700;">${orphansDeleted} eliminados</span>`
        : `<span style="color:#95a5a6;">0</span>`;

    // ── Cuerpo de la tabla según estado ─────────────────────────────────────
    const isTerminal = ['success', 'error', 'canceled'].includes(status);
    const isRunning  = status === 'running';
    const isEnqueued = status === 'enqueued';
    const isError    = status === 'error';
    const isCanceled = status === 'canceled';

    // Sección de error destacada (solo para status === 'error')
    const errorSection = (isError && payload.error) ? `
        <div style="margin-bottom:20px;padding:14px 18px;background:#fdedec;border:1px solid #f1948a;border-radius:6px;">
            <div style="font-size:12px;font-weight:700;color:#a93226;letter-spacing:0.5px;margin-bottom:6px;">❌ MOTIVO DEL ERROR</div>
            <div style="font-size:13px;color:#922b21;font-family:monospace;word-break:break-word;">${error}</div>
        </div>
    ` : '';

    // Sección de cancelación (solo para status === 'canceled')
    const canceledSection = isCanceled ? `
        <div style="margin-bottom:20px;padding:14px 18px;background:#f2f3f4;border:1px solid #d5dbdb;border-radius:6px;">
            <div style="font-size:13px;color:#566573;">🚫 El job fue cancelado antes de completarse.</div>
        </div>
    ` : '';

    // Filas de stats: varían según el estado del job
    const jobIdRow = jobId
        ? row('Job ID', '<code style="font-family:monospace;font-size:12px;background:#f4f6f7;padding:2px 6px;border-radius:4px;color:#555;">' + jobId + '</code>', { bg: '#f8f9fa' })
        : '';

    let statsRows = '';
    if (status === 'success') {
        statsRows = [
            jobIdRow,
            row('Productos procesados', processed.toLocaleString('es-AR'), { bold: true }),
            row('Precios actualizados', updatedPrices.toLocaleString('es-AR'), { bg: '#f8f9fa', valueColor: '#1a5276', bold: true }),
            row('Productos eliminados (huérfanos)', orphansValue),
            row('Duración total', formatMs(durationMs), { bg: '#f8f9fa' }),
            row('Errores detectados', errorsValue),
            row('Finalizado el', formatDate(timestamp)),
            queueSection,
        ].join('');
    } else if (status === 'error') {
        statsRows = [
            jobIdRow,
            durationMs ? row('Duración hasta el error', formatMs(durationMs), { bg: '#f8f9fa' }) : '',
            row('Momento del fallo', formatDate(timestamp)),
        ].join('');
    } else if (status === 'running') {
        statsRows = [
            jobIdRow,
            row('Inicio', formatDate(timestamp)),
        ].join('');
    } else if (status === 'enqueued') {
        statsRows = [
            jobIdRow,
            row('Encolado el', formatDate(timestamp)),
            queueSection,
        ].join('');
    } else if (status === 'canceled') {
        statsRows = [
            jobIdRow,
            durationMs ? row('Tiempo ejecutado antes de cancelar', formatMs(durationMs), { bg: '#f8f9fa' }) : '',
            row('Cancelado el', formatDate(timestamp)),
        ].join('');
    }

    // ── HTML final ───────────────────────────────────────────────────────
    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f3f4;font-family:Arial,Helvetica,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f4;padding:32px 0;">
  <tr><td align="center">
  <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- HEADER -->
    <tr>
      <td style="background:${s.headerBg};border-bottom:3px solid ${s.badgeBorder};padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:22px;font-weight:700;color:${s.headerColor};">${s.emoji}&nbsp; ${sourceLabel}</div>
              <div style="margin-top:6px;font-size:13px;color:#7f8c8d;">Reporte automático del sistema de sincronización</div>
            </td>
            <td align="right" valign="top">
              <span style="display:inline-block;background:${s.badgeBg};color:${s.badgeColor};border:1px solid ${s.badgeBorder};
                           padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.5px;">
                ${s.label.toUpperCase()}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="padding:24px 28px;">

        ${errorSection}
        ${canceledSection}

        <!-- Stats table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <td colspan="2" style="padding:10px 14px;border:1px solid #e5e8e8;font-size:11px;font-weight:700;color:#95a5a6;letter-spacing:0.8px;">
                📊 INFORMACIÓN DEL JOB
              </td>
            </tr>
          </thead>
          <tbody>
            ${statsRows}
          </tbody>
        </table>

      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#f8f9fa;border-top:1px solid #e5e8e8;padding:14px 28px;">
        <p style="margin:0;font-size:11px;color:#aab7b8;text-align:center;">
          Este es un mensaje automático generado por el sistema de Meyfer. No responder este correo.
        </p>
      </td>
    </tr>

  </table>
  </td></tr>
</table>

</body>
</html>`;

    const subject = `${s.emoji} [${s.label}] Scraper: ${sourceLabel}`;

    return { subject, html };
}

module.exports = { buildScraperEmail };
