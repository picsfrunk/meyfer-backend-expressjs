/**
 * buildPriceCheckEmail.js
 *
 * Genera el HTML del email de reporte de price check.
 *
 * @param {object} payload
 * @param {object}  payload.summary   - { changed, new, removed, total_odoo, total_db, failed, checkedAt, durationMs }
 * @param {Array}   payload.changed   - [{ product_id, display_name, old_price, new_price, diff, diff_percent }]
 * @param {string}  payload.status    - 'success' | 'completed' | 'enqueued' | 'queued' | 'started' | 'running' | 'error' | 'failed' | 'canceled'
 * @param {string}  [payload.error]   - mensaje de error si falló
 * @returns {{ subject: string, html: string }}
 */
function buildPriceCheckEmail({ summary = {}, changed = [], status = 'success', error = null, timestamp = null, jobId = null, queueInfo = null }) {
    const normalizedStatus = normalizeStatus(status);
    const isSuccess = normalizedStatus === 'success';
    const isQueued = normalizedStatus === 'queued';
    const isRunning = normalizedStatus === 'running';
    const isInProgress = isQueued || isRunning;
    const isCanceled = normalizedStatus === 'canceled';

    const formatMs = (ms) => {
        if (!ms) return '—';
        const sec = Math.floor(ms / 1000);
        const min = Math.floor(sec / 60);
        return min > 0 ? `${min}m ${sec % 60}s` : `${sec}s`;
    };

    const formatDate = (ts) => {
        try { return new Date(ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' }); }
        catch { return ts ?? '—'; }
    };

    const formatPrice = (n) =>
        n != null ? `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

    // ── Colores ──────────────────────────────────────────────────────────────
    const headerColor = isSuccess ? '#1a5276' : (isInProgress ? '#1a5276' : (isCanceled ? '#566573' : '#a93226'));
    const headerBg    = isSuccess ? '#eaf4fb' : (isInProgress ? '#eaf4fb' : (isCanceled ? '#f2f3f4' : '#fdedec'));
    const headerBorder= isSuccess ? '#85c1e9' : (isInProgress ? '#85c1e9' : (isCanceled ? '#d5dbdb' : '#f1948a'));

    // ── Tabla de resumen ─────────────────────────────────────────────────────
    const row = (label, value, bg = 'transparent') => `
        <tr style="background:${bg};">
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:#566573;font-size:13px;">${label}</td>
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:#2c3e50;font-size:13px;font-weight:600;">${value}</td>
        </tr>`;

    const badge = (n, color, bg) =>
        `<span style="background:${bg};color:${color};padding:2px 10px;border-radius:12px;font-weight:700;">${n}</span>`;

    const progressRows = `
        ${jobId ? row('Job ID', `<code style="font-family:monospace;font-size:12px;background:#f4f6f7;padding:2px 6px;border-radius:4px;color:#555;">${jobId}</code>`, '#f8f9fa') : ''}
        ${row('Estado', `<span style="color:#1a5276;">${isQueued ? 'En cola' : 'Iniciada correctamente'}</span>`)}
        ${isQueued && queueInfo?.position != null ? row('Posición en cola', queueInfo.position, '#f8f9fa') : ''}
        ${isQueued && queueInfo?.pendingAfter != null ? row('Jobs pendientes', queueInfo.pendingAfter) : ''}
        ${row(isQueued ? 'Encolado el' : 'Iniciado el', formatDate(timestamp ?? Date.now()), '#f8f9fa')}
    `;

    const summaryRows = isSuccess ? `
        ${row('Productos verificados', (summary.total_odoo ?? 0).toLocaleString('es-AR'), '#f8f9fa')}
        ${row('Precios cambiados',
            summary.changed > 0
                ? badge(summary.changed, '#a93226', '#fadbd8')
                : badge(0, '#1a7f4b', '#eafaf1')
        )}
        ${row('Productos nuevos',
            summary.new > 0
                ? badge(summary.new, '#1a5276', '#d6eaf8')
                : badge(0, '#1a7f4b', '#eafaf1'),
            '#f8f9fa'
        )}
        ${row('Productos eliminados',
            summary.removed > 0
                ? badge(summary.removed, '#d35400', '#fdebd0')
                : badge(0, '#1a7f4b', '#eafaf1')
        )}
        ${summary.failed > 0 ? row('Sin respuesta de Odoo', badge(summary.failed, '#7d6608', '#fef9e7'), '#f8f9fa') : ''}
        ${row('Duración', formatMs(summary.durationMs), summary.failed > 0 ? 'transparent' : '#f8f9fa')}
        ${row('Ejecutado el', formatDate(summary.checkedAt))}
    ` : (isInProgress ? progressRows : (isCanceled ? `
        ${row('Estado', `<span style="color:#566573;">Cancelado</span>`)}
    ` : `
        ${row('Error', `<span style="color:#a93226;">${error ?? 'Error desconocido'}</span>`)}
    `));

    // ── Tabla de productos con precios cambiados ──────────────────────────────
    const changedTable = (isSuccess && changed.length > 0) ? `
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border-collapse:collapse;margin-top:24px;">
            <thead>
                <tr style="background:#1a5276;">
                    <td style="padding:10px 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;">CÓDIGO</td>
                    <td style="padding:10px 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;">PRODUCTO</td>
                    <td style="padding:10px 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-align:right;">PRECIO ANTERIOR</td>
                    <td style="padding:10px 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-align:right;">PRECIO NUEVO</td>
                    <td style="padding:10px 14px;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.8px;text-align:right;">DIFERENCIA</td>
                </tr>
            </thead>
            <tbody>
                ${changed.map((p, i) => {
                    const isUp      = p.diff > 0;
                    const diffColor = isUp ? '#a93226' : '#1a7f4b';
                    const diffBg    = isUp ? '#fadbd8' : '#eafaf1';
                    const arrow     = isUp ? '▲' : '▼';
                    const pct       = p.diff_percent != null ? ` (${arrow}${Math.abs(p.diff_percent)}%)` : '';
                    const rowBg     = i % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    return `
                    <tr style="background:${rowBg};">
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;font-family:monospace;color:#566573;">
                            ${p.product_id}
                        </td>
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;color:#2c3e50;">
                            ${p.display_name ?? '—'}
                        </td>
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;text-align:right;color:#7f8c8d;text-decoration:line-through;">
                            ${formatPrice(p.old_price)}
                        </td>
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;text-align:right;font-weight:700;color:#2c3e50;">
                            ${formatPrice(p.new_price)}
                        </td>
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;text-align:right;">
                            <span style="background:${diffBg};color:${diffColor};padding:2px 8px;border-radius:10px;font-weight:700;">
                                ${isUp ? '+' : ''}${formatPrice(p.diff)}${pct}
                            </span>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    ` : (isSuccess && changed.length === 0 ? `
        <div style="margin-top:20px;padding:16px;background:#eafaf1;border-radius:6px;border:1px solid #a9dfbf;text-align:center;color:#1a7f4b;font-size:14px;">
            ✅ Sin cambios de precios detectados
        </div>
    ` : '');

    // ── Asunto ───────────────────────────────────────────────────────────────
    const emoji   = isSuccess ? (summary.changed > 0 ? '💰' : '✅') : (isInProgress ? 'ℹ️' : (isCanceled ? '🚫' : '❌'));
    const subject = isSuccess
        ? `${emoji} Verificación de precios — ${summary.changed} cambio${summary.changed !== 1 ? 's' : ''} detectado${summary.changed !== 1 ? 's' : ''}`
        : (isRunning
            ? 'Verificación de precios iniciada'
            : (isQueued
                ? 'Verificación de precios en cola'
                : (isCanceled ? `🚫 Verificación de precios — Cancelado` : 'Error en la verificación de precios')));

    const introText = isInProgress
        ? (isQueued
            ? 'La verificación de precios fue recibida correctamente y quedó en cola para ejecutarse.'
            : 'La verificación de precios se inició correctamente. El sistema comparará los precios actuales del sitio fuente con los productos guardados.')
        : 'Reporte automático de cambios en el catálogo de Odoo';

    const badgeBg = isSuccess ? '#d6eaf8' : (isInProgress ? '#d6eaf8' : (isCanceled ? '#ebedef' : '#fadbd8'));
    const badgeText = isSuccess ? 'COMPLETADO' : (isRunning ? 'INICIADA' : (isQueued ? 'EN COLA' : (isCanceled ? 'CANCELADO' : 'ERROR')));

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f3f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f4;padding:32px 0;">
  <tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0"
         style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

    <!-- HEADER -->
    <tr>
      <td style="background:${headerBg};border-bottom:3px solid ${headerBorder};padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="font-size:20px;font-weight:700;color:${headerColor};">
              ${emoji}&nbsp; Verificación de Precios
            </div>
            <div style="margin-top:5px;font-size:13px;color:#7f8c8d;">
              ${introText}
            </div>
          </td>
          <td align="right" valign="top">
            <span style="display:inline-block;background:${badgeBg};
                         color:${headerColor};border:1px solid ${headerBorder};
                         padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">
              ${badgeText}
            </span>
          </td>
        </tr></table>
      </td>
    </tr>

    <!-- BODY -->
    <tr><td style="padding:24px 28px;">

      <!-- Resumen -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr style="background:#f8f9fa;">
            <td colspan="2" style="padding:10px 14px;border:1px solid #e5e8e8;
                font-size:11px;font-weight:700;color:#95a5a6;letter-spacing:0.8px;">
              📊 RESUMEN
            </td>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>

      <!-- Tabla de cambios -->
      ${changedTable}

    </td></tr>

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

    return { subject, html };
}

function normalizeStatus(status) {
    if (['success', 'completed'].includes(status)) return 'success';
    if (['queued', 'enqueued'].includes(status)) return 'queued';
    if (['started', 'running'].includes(status)) return 'running';
    if (status === 'canceled') return 'canceled';
    return 'error';
}

module.exports = { buildPriceCheckEmail };
