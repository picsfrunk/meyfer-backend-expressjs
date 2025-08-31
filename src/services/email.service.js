// src/services/email.service.js
const nodemailer = require('nodemailer');

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

// útil para diagnóstico al boot
async function verifyTransporter() {
    try {
        await transporter.verify();
        console.log('[mail] Transporter verificado OK');
    } catch (err) {
        console.error('[mail] Error verificando transporter:', err.message);
    }
}

// Helper de formato de moneda
function fmt(amount) {
    try {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: LOCAL_CURRENCY,
            minimumFractionDigits: 2
        }).format(Number(amount || 0));
    } catch {
        return `${amount}`;
    }
}

// Template simple (podés moverlo a un .html si querés)
function buildOrderHtml(order) {
    const { order_id, customerInfo = {}, cartItems = [], total, totalItems } = order;
    const itemsHtml = cartItems.map(ci => {
        const p = ci.productCartItem || {};
        return `
      <tr>
        <td>${p.product_id ?? '-'}</td>
        <td>${p.display_name ?? p.title ?? '-'}</td>
        <td>${ci.qty}</td>
        <td>${fmt(p.list_price ?? 0)}</td>
      </tr>
    `;
    }).join('');

    return `
    <div style="font-family:Arial,Helvetica,sans-serif">
      <h2>Nuevo pedido #${order_id}</h2>
      <p><strong>Cliente:</strong> ${customerInfo?.cliente || '-'}</p>
      <p><strong>Email:</strong> ${customerInfo?.email || '-'}</p>
      <p><strong>Tel:</strong> ${customerInfo?.telefono1 || '-'}</p>

      <h3>Resumen</h3>
      <p><strong>Ítems:</strong> ${totalItems} &nbsp; | &nbsp; <strong>Total:</strong> ${fmt(total)}</p>

      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%;">
        <thead>
          <tr>
            <th style="text-align:left">ID</th>
            <th style="text-align:left">Producto</th>
            <th style="text-align:left">Cant.</th>
            <th style="text-align:left">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <p style="margin-top:16px;">Este es un correo automático.</p>
    </div>
  `;
}

// Enviar notificación interna (a administración)
async function sendOrderNotificationToAdmin(order) {
    const html = buildOrderHtml(order);
    const subject = `Nuevo pedido #${order.order_id} - ${order?.customerInfo?.cliente || ''}`;

    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to: MAIL_TO_ADMIN,
        subject,
        html
    });

    return info;
}

// (Opcional) Enviar confirmación al cliente
async function sendOrderConfirmationToCustomer(order) {
    const to = order?.customerInfo?.email;
    if (!to) return null;

    const html = `
    <div style="font-family:Arial,Helvetica,sans-serif">
      <h2>¡Gracias por tu pedido!</h2>
      <p>Tu número de pedido es <strong>${order.order_id}</strong>.</p>
      <p>Pronto nos estaremos contactando para coordinar la entrega.</p>
    </div>
  `;

    const info = await transporter.sendMail({
        from: MAIL_FROM,
        to,
        subject: `Confirmación de pedido #${order.order_id}`,
        html
    });

    return info;
}

module.exports = {
    verifyTransporter,
    sendOrderNotificationToAdmin,
    sendOrderConfirmationToCustomer
};
