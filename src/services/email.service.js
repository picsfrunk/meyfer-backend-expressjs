const nodemailer = require('nodemailer');
const buildOrderHtml = require("../utils/buildOrderHtml");

const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    MAIL_FROM,
    MAIL_TO_ADMIN,
    LOCAL_CURRENCY = 'ARS'
} = process.env;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE) === 'true', // true para 465
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
    }
});

async function verifyTransporter() {
    try {
        await transporter.verify();
        console.log('[mail] Transporter verificado OK');
    } catch (err) {
        console.error('[mail] Error verificando transporter:', err.message);
    }
}

async function sendOrderNotificationToAdmin(order) {
    const html = buildOrderHtml(order);
    const subject = `Nuevo pedido #${order.orderId} - ${order?.customerInfo?.cliente || ''}`;

    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to: MAIL_TO_ADMIN,
        subject,
        html
    });

    return info;
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

    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject: `Confirmación de pedido #${order.orderId}`,
        html
    });

    return info;
}

module.exports = {
    verifyTransporter,
    sendOrderNotificationToAdmin,
    sendOrderConfirmationToCustomer
};
