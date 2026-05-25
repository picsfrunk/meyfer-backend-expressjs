const buildOrderHtml = require("../utils/buildOrderHtml");
const buildCustomerOrderConfirmationHtml = require("../utils/buildCustomerOrderConfirmationHtml");
const { buildScraperEmail }     = require("../utils/buildScraperEmail");
const { buildPriceCheckEmail }  = require("../utils/buildPriceCheckEmail");
const { mailjet }       = require("./MailJet.service");
const ConfigService     = require("./config.service");
const ScrapedProduct    = require("../models/products.model");

const MAIL_FROM = process.env.MAIL_FROM || process.env.MJ_SENDER_EMAIL;
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || process.env.MJ_SENDER_NAME || "Tienda";

async function _send({ to, subject, html, name = MAIL_FROM_NAME }) {
    if (!mailjet) {
        console.warn("⚠️ Mailjet no disponible.");
        return { success: false, error: "Mailjet no inicializado" };
    }

    if (!MAIL_FROM) {
        console.warn('[mail] MAIL_FROM/MJ_SENDER_EMAIL no configurado. No se enviará el email.');
        return { success: false, error: "Sender email no configurado" };
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

async function enrichOrderProducts(order) {
    const plainOrder = typeof order?.toObject === 'function'
        ? order.toObject()
        : { ...(order || {}) };

    if (!Array.isArray(plainOrder.items) || plainOrder.items.length === 0) {
        return plainOrder;
    }

    const enrichedItems = await Promise.all(plainOrder.items.map(async item => {
        if (item.product || item.productCartItem) return item;

        const product = await ScrapedProduct.findOne({ product_id: item.product_id }).lean();
        return product ? { ...item, product } : item;
    }));

    return {
        ...plainOrder,
        items: enrichedItems
    };
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

    const orderForEmail = await enrichOrderProducts(order);

    return _send({
        to,
        subject: `Confirmación de pedido #${order.orderId}`,
        html: buildCustomerOrderConfirmationHtml(orderForEmail)
    });
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
