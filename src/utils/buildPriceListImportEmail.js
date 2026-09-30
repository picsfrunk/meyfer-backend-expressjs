function buildPriceListImportEmail(payload = {}) {
    const {
        jobId = null,
        sourceType = null,
        processName = 'Importación de lista de precios',
        status = 'received',
        completedAt = null,
        startedAt = null,
        summary = {},
        error = null,
        errorsSummary = [],
    } = payload;

    const state = normalizeEmailState(status);
    const isSuccess = state.key === 'success';
    const isError = state.key === 'error';
    const sourceLabel = {
        manual_upload: 'Archivo manual',
        remote_configured_url: 'URL configurada',
    }[sourceType] ?? (sourceType || 'No informado');

    const formatNumber = (n) =>
        n != null ? Number(n).toLocaleString('es-AR') : '-';

    const formatDate = (ts) => {
        if (!ts) return '-';
        try { return new Date(ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' }); }
        catch { return ts; }
    };

    const row = (label, value, bg = 'transparent') => `
        <tr style="background:${bg};">
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:#566573;font-size:13px;">${label}</td>
            <td style="padding:10px 14px;border:1px solid #e5e8e8;color:#2c3e50;font-size:13px;font-weight:600;">${value}</td>
        </tr>`;

    const code = (value) =>
        value ? `<code style="font-family:monospace;font-size:12px;background:#f4f6f7;padding:2px 6px;border-radius:4px;color:#555;">${value}</code>` : '-';

    const badge = (value, color, bg) =>
        `<span style="background:${bg};color:${color};padding:2px 10px;border-radius:12px;font-weight:700;">${value}</span>`;

    const errors = Array.isArray(errorsSummary) ? errorsSummary.filter(Boolean).slice(0, 8) : [];
    const errorBlock = isError ? `
        <div style="margin-bottom:20px;padding:14px 18px;background:#fdedec;border:1px solid #f1948a;border-radius:6px;">
            <div style="font-size:12px;font-weight:700;color:#a93226;letter-spacing:0.5px;margin-bottom:6px;">MOTIVO DEL ERROR</div>
            <div style="font-size:13px;color:#922b21;font-family:monospace;word-break:break-word;">${error || 'Error desconocido'}</div>
        </div>
    ` : '';

    const errorsBlock = errors.length ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
            <thead>
                <tr style="background:#f8f9fa;">
                    <td style="padding:10px 14px;border:1px solid #e5e8e8;font-size:11px;font-weight:700;color:#95a5a6;letter-spacing:0.8px;">
                        ERRORES RESUMIDOS
                    </td>
                </tr>
            </thead>
            <tbody>
                ${errors.map((message, i) => `
                    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8f9fa'};">
                        <td style="padding:9px 14px;border:1px solid #e5e8e8;font-size:12px;color:#566573;">${message}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    ` : '';

    const subject = `${state.emoji} ${processName} — ${sourceLabel} ${state.subjectSuffix}`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f2f3f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f2f3f4;padding:32px 0;">
  <tr><td align="center">
  <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <tr>
      <td style="background:${state.headerBg};border-bottom:3px solid ${state.headerBorder};padding:24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <div style="font-size:20px;font-weight:700;color:${state.headerColor};">${state.emoji}&nbsp; ${processName}</div>
            <div style="margin-top:5px;font-size:13px;color:#7f8c8d;">Reporte automático de importación de precios</div>
          </td>
          <td align="right" valign="top">
            <span style="display:inline-block;background:${state.badgeBg};color:${state.headerColor};border:1px solid ${state.headerBorder};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700;">
              ${state.label}
            </span>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr><td style="padding:24px 28px;">
      ${errorBlock}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr style="background:#f8f9fa;">
            <td colspan="2" style="padding:10px 14px;border:1px solid #e5e8e8;font-size:11px;font-weight:700;color:#95a5a6;letter-spacing:0.8px;">
              RESUMEN
            </td>
          </tr>
        </thead>
        <tbody>
          ${row('Job ID', code(jobId), '#f8f9fa')}
          ${row('Fuente', sourceLabel)}
          ${row('Inicio', formatDate(startedAt), '#f8f9fa')}
          ${row('Finalización', formatDate(completedAt))}
          ${row('Filas totales', formatNumber(summary.totalRows), '#f8f9fa')}
          ${row('Filas válidas', formatNumber(summary.validRows))}
          ${row('Productos actualizados', badge(formatNumber(summary.updatedProducts), '#1a5276', '#d6eaf8'), '#f8f9fa')}
          ${row('Productos sin cambios', formatNumber(summary.unchangedProducts))}
          ${row('Productos no encontrados', formatNumber(summary.notFoundProducts), '#f8f9fa')}
          ${row('Filas inválidas', summary.invalidRows > 0 ? badge(formatNumber(summary.invalidRows), '#a93226', '#fadbd8') : formatNumber(summary.invalidRows))}
          ${row('Duplicados', summary.duplicates > 0 ? badge(formatNumber(summary.duplicates), '#d35400', '#fdebd0') : formatNumber(summary.duplicates), '#f8f9fa')}
        </tbody>
      </table>
      ${errorsBlock}
    </td></tr>
    <tr>
      <td style="background:#f8f9fa;border-top:1px solid #e5e8e8;padding:14px 28px;">
        <p style="margin:0;font-size:11px;color:#aab7b8;text-align:center;">Este es un mensaje automático generado por el sistema de Meyfer. No responder este correo.</p>
      </td>
    </tr>
  </table>
  </td></tr>
</table>
</body>
</html>`;

    return { subject, html };
}

function normalizeEmailState(status) {
    const normalized = String(status || '').toLowerCase();

    if (['success', 'completed', 'succeeded', 'done', 'finished'].includes(normalized)) {
        return {
            key: 'success',
            emoji: '✅',
            label: 'COMPLETADO',
            subjectSuffix: 'completada',
            headerColor: '#1a7f4b',
            headerBg: '#eafaf1',
            headerBorder: '#a9dfbf',
            badgeBg: '#d4efdf',
        };
    }

    if (['error', 'failed', 'errored', 'failure', 'canceled', 'cancelled'].includes(normalized)) {
        return {
            key: 'error',
            emoji: '❌',
            label: normalized === 'canceled' || normalized === 'cancelled' ? 'CANCELADO' : 'ERROR',
            subjectSuffix: normalized === 'canceled' || normalized === 'cancelled' ? 'cancelada' : 'falló',
            headerColor: '#a93226',
            headerBg: '#fdedec',
            headerBorder: '#f1948a',
            badgeBg: '#fadbd8',
        };
    }

    if (['started', 'running', 'processing'].includes(normalized)) {
        return {
            key: 'running',
            emoji: '⚙️',
            label: 'EN PROCESO',
            subjectSuffix: 'en proceso',
            headerColor: '#1a5276',
            headerBg: '#eaf4fb',
            headerBorder: '#85c1e9',
            badgeBg: '#d6eaf8',
        };
    }

    if (['enqueued', 'queued', 'pending', 'accepted'].includes(normalized)) {
        return {
            key: 'enqueued',
            emoji: '⏳',
            label: 'EN COLA',
            subjectSuffix: 'en cola',
            headerColor: '#7d6608',
            headerBg: '#fef9e7',
            headerBorder: '#f8c471',
            badgeBg: '#fdebd0',
        };
    }

    return {
        key: 'received',
        emoji: 'ℹ️',
        label: 'ESTADO RECIBIDO',
        subjectSuffix: 'estado recibido',
        headerColor: '#566573',
        headerBg: '#f2f3f4',
        headerBorder: '#d5dbdb',
        badgeBg: '#ebedef',
    };
}

module.exports = { buildPriceListImportEmail, normalizeEmailState };
