const buildOrderHtml = require("../utils/buildOrderHtml");
const { buildScraperEmail }     = require("../utils/buildScraperEmail");
const { buildPriceCheckEmail }  = require("../utils/buildPriceCheckEmail");
const { mailjet }       = require("./MailJet.service");
const ConfigService     = require("./config.service");

const { MAIL_FROM, MAIL_FROM_NAME } = process.env;

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

async function sendOrderNotificationToAdmins(order) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    return _send({
        to: adminEmails,
        subject: `Nuevo pedido #${order.orderId} - ${order?.customerInfo?.cliente || ""}`,
        html: buildOrderHtml(order),
    });
}

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
 * Envía notificación de estado de Scraper a admins.
 * El HTML y subject se generan en utils/buildScraperEmail.js
 */
async function sendScraperFinishedNotification(payload = {}) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    const { subject, html } = buildScraperEmail(payload);
    return _send({ to: adminEmails, subject, html });
}

/**
 * Envía notificación de resultado de verificación de precios a admins.
 * El HTML y subject se generan en utils/buildPriceCheckEmail.js
 */
async function sendPriceCheckNotification(payload = {}) {
    const adminEmails = await ConfigService.listActiveAdminEmails();
    if (!adminEmails.length) return { success: false, error: "No hay admins activos" };

    const { subject, html } = buildPriceCheckEmail(payload);
    return _send({ to: adminEmails, subject, html });
}

module.exports = {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer,
    sendScraperFinishedNotification,
    sendPriceCheckNotification,
};
