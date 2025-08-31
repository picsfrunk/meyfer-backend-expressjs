const buildOrderHtml = require("../utils/buildOrderHtml");
const { mailjet} = require("./MailJet.service");

const {
    MAIL_FROM,
    MAIL_FROM_NAME,
    MAIL_TO_ADMIN,
} = process.env;


async function sendOrderNotificationToAdmin(order) {
    if (!mailjet) {
        console.warn("⚠️ Mailjet no disponible. No se envió el correo.");
        return { success: false, error: "Mailjet no inicializado" };
    }

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
    if (!mailjet) {
        console.warn("⚠️ Mailjet no disponible. No se envió el correo.");
        return { success: false, error: "Mailjet no inicializado" };
    }

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
