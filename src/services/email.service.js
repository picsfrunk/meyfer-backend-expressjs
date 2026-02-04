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
 * Envía notificación de fin de Scraper a admins
 */
async function sendScraperFinishedNotification(payload = {}) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    const { source, status, processed, timestamp, jobId, stats = {} } = payload;
    const finalProcessed = processed ?? stats.productsAdded ?? 0;

    const html = `
        <div style="font-family:Arial,sans-serif">
            <h2 style="color: #2c3e50;">🚀 Scraper Finalizado</h2>
            <p><strong>Fuente:</strong> ${source || 'Desconocida'}</p>
            ${jobId ? `<p><strong>Job ID:</strong> ${jobId}</p>` : ''}
            <p><strong>Estado:</strong> <span style="color: ${status === 'success' ? 'green' : 'red'}">${status}</span></p>
            <p><strong>Items Procesados:</strong> ${finalProcessed}</p>
            <p><strong>Fecha:</strong> ${timestamp || new Date().toLocaleString()}</p>
            <hr>
            <p style="font-size: 12px; color: #7f8c8d;">Notificación automática del sistema Meyfer.</p>
        </div>`;

    return _send({
        to: adminEmails,
        subject: `🤖 Scraper ${status}: ${source || ''}`,
        html
    });
}

module.exports = {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer,
    sendScraperFinishedNotification
};