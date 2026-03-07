const buildOrderHtml = require("../utils/buildOrderHtml");
const { mailjet } = require("./MailJet.service");
const ConfigService = require("./config.service");

const { MAIL_FROM, MAIL_FROM_NAME } = process.env;

/**
 * Función núcleo privada para enviar correos usando Mailjet
 */
async function _send({ to, subject, html, name = MAIL_FROM_NAME || "Tienda" }) {
    if (!mailjet) {
        console.warn("⚠️ Mailjet no disponible.");
        return { success: false, error: "Mailjet no inicializado" };
    }

    const recipients = Array.isArray(to)
        ? to.map(email => ({ Email: email }))
        : [{ Email: to }];

    try {
        const result = await mailjet
            .post("send", { version: "v3.1" })
            .request({
                Messages: [{
                    From: { Email: MAIL_FROM, Name: name },
                    To: recipients,
                    Subject: subject,
                    HTMLPart: html,
                }],
            });
        return { success: true, data: result.body };
    } catch (err) {
        console.error(`[mail] Error enviando correo "${subject}":`, err.message);
        throw err;
    }
}

/**
 * Envía notificación de nuevo pedido a admins
 */
async function sendOrderNotificationToAdmins(order) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    return _send({
        to: adminEmails,
        subject: `Nuevo pedido #${order.orderId} - ${order?.customerInfo?.cliente || ""}`,
        html: buildOrderHtml(order)
    });
}

/**
 * Envía confirmación de pedido al cliente
 */
async function sendOrderConfirmationToCustomer(order) {
    const to = order?.customerInfo?.email;
    if (!to) return null;

    const html = `
        <div style="font-family:Arial,sans-serif">
            <h2>¡Gracias por tu pedido!</h2>
            <p>Tu número de pedido es <strong>${order.orderId}</strong>.</p>
            <p>Pronto nos estaremos contactando para coordinar la entrega.</p>
        </div>`;

    return _send({ to, subject: `Confirmación de pedido #${order.orderId}`, html });
}

/**
 * Envía notificación de fin de Scraper a admins con estadísticas detalladas.
 * Ahora incluye información de cola si está disponible.
 */
async function sendScraperFinishedNotification(payload = {}) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    const {
        source,
        status,
        processed,
        stats = {},
        timestamp,
        queueInfo = null,
    } = payload;

    const {
        updatedPrices  = 0,
        totalErrors    = 0,
        durationMs     = 0,
        orphansDeleted = 0,
    } = stats;

    const durationSec  = durationMs ? Math.floor(durationMs / 1000) : 0;
    const minutes      = Math.floor(durationSec / 60);
    const seconds      = durationSec % 60;
    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    const isSuccess    = status === 'success';

    // Sección de info de cola (solo si viene el dato)
    const queueSection = queueInfo ? `
        <tr style="background-color: #f0f7ff;">
            <td colspan="2" style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #2980b9;">
                📋 Estado de Cola
            </td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Jobs pendientes tras finalizar</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; color: ${queueInfo.pendingAfter > 0 ? '#e67e22' : '#27ae60'};">
                <strong>${queueInfo.pendingAfter}</strong>
                ${queueInfo.pendingAfter > 0 ? ' (hay scrapers esperando)' : ' (cola vacía)'}
            </td>
        </tr>
        ${queueInfo.waitTimeMs != null ? `
        <tr style="background-color: #f8f9fa;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Tiempo en espera previo</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${_formatMs(queueInfo.waitTimeMs)}</td>
        </tr>` : ''}
    ` : '';

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: ${isSuccess ? '#27ae60' : '#c0392b'}; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                ${isSuccess ? '✅' : '❌'} Scraper: ${source}
            </h2>
            <p>El proceso de sincronización finalizó con estado: <strong>${status.toUpperCase()}</strong></p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Productos Procesados</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${processed}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Precios Actualizados</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: #2980b9;"><strong>${updatedPrices}</strong></td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Productos Eliminados</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: ${orphansDeleted > 0 ? '#e67e22' : '#95a5a6'};">
                        <strong>${orphansDeleted}</strong>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Duración</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${durationText}</td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Errores detectados</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: ${totalErrors > 0 ? '#e74c3c' : '#27ae60'};">
                        ${totalErrors}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Finalizado el</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${new Date(timestamp).toLocaleString('es-AR')}</td>
                </tr>
                ${queueSection}
            </table>

            <p style="font-size: 12px; color: #95a5a6; margin-top: 30px;">
                Este es un mensaje automático del Backend de Meyfer.
            </p>
        </div>`;

    return _send({
        to: adminEmails,
        subject: `${isSuccess ? '✅' : '❌'} Reporte Scraper: ${source}`,
        html
    });
}

function _formatMs(ms) {
    if (!ms) return '0s';
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    return min > 0 ? `${min}m ${sec % 60}s` : `${sec}s`;
}

module.exports = {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer,
    sendScraperFinishedNotification
};
