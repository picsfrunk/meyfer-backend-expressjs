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
                Messages: [
                    {
                        From: { Email: MAIL_FROM, Name: name },
                        To: recipients,
                        Subject: subject,
                        HTMLPart: html,
                    },
                ],
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

    return _send({
        to,
        subject: `Confirmación de pedido #${order.orderId}`,
        html
    });
}

/**
 * Envía notificación de fin de Scraper a admins con estadísticas detalladas
 */
async function sendScraperFinishedNotification(payload = {}) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    const { source, status, processed, stats = {}, timestamp } = payload;
    const { updatedPrices = 0, totalErrors = 0, durationMs = 0 } = stats;

    const durationSec = durationMs ? Math.floor(durationMs / 1000) : 0;
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const isSuccess = status === 'success';

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #eee; padding: 20px;">
            <h2 style="color: ${isSuccess ? '#27ae60' : '#c0392b'}; border-bottom: 2px solid #eee; padding-bottom: 10px;">
                ${isSuccess ? '✅' : '❌'} Scraper: ${source}
            </h2>
            <p>El proceso de sincronización ha finalizado con estado: <strong>${status.toUpperCase()}</strong></p>
            
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
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Duración</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${durationText}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Errores detectados</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd; color: ${totalErrors > 0 ? '#e74c3c' : '#27ae60'};">
                        ${totalErrors}
                    </td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Finalizado el</strong></td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${new Date(timestamp).toLocaleString('es-AR')}</td>
                </tr>
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

module.exports = {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer,
    sendScraperFinishedNotification
};