const Mailjet = require('node-mailjet');
const buildOrderHtml = require("../utils/buildOrderHtml");

const {
    MJ_APIKEY_PUBLIC,
    MJ_APIKEY_PRIVATE,
    MAIL_FROM,
    MAIL_FROM_NAME,
    MAIL_TO_ADMIN,
} = process.env;

const mailjet = Mailjet.apiConnect(MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE);

async function sendOrderNotificationToAdmin(order) {
    const html = buildOrderHtml(order);
    const subject = `Nuevo pedido #${order.orderId} - ${order?.customerInfo?.cliente || ''}`;

    try {
        const result = await mailjet
            .post("send", { version: "v3.1" })
            .request({
                Messages: [
                    {
                        From: {
                            Email: MAIL_FROM,
                            Name: MAIL_FROM_NAME || "Tienda",
                        },
                        To: [
                            {
                                Email: MAIL_TO_ADMIN,
                            },
                        ],
                        Subject: subject,
                        HTMLPart: html,
                    },
                ],
            });

        return result.body;
    } catch (err) {
        console.error("[mail] Error enviando notificación admin:", err.message);
        throw err;
    }
}

async function sendOrderConfirmationToCustomer(order) {
    const to = order?.customerInfo?.email;
    if (!to) return null;

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif">
      <h2>¡Gracias por tu pedido!</h2>
      <p>Tu número de pedido es <strong>${order.orderId}</strong>.</p>
      <p>Pronto nos estaremos contactando para coordinar la entrega.</p>
    </div>
  `;

    try {
        const result = await mailjet
            .post("send", { version: "v3.1" })
            .request({
                Messages: [
                    {
                        From: {
                            Email: MAIL_FROM,
                            Name: MAIL_FROM_NAME || "Tienda",
                        },
                        To: [
                            {
                                Email: to,
                            },
                        ],
                        Subject: `Confirmación de pedido #${order.orderId}`,
                        HTMLPart: html,
                    },
                ],
            });

        return result.body;
    } catch (err) {
        console.error("[mail] Error enviando confirmación al cliente:", err.message);
        throw err;
    }
}

module.exports = {
    sendOrderNotificationToAdmin,
    sendOrderConfirmationToCustomer,
};
