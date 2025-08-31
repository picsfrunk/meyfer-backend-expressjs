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

// para diagnóstico al boot
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

function buildOrderHtml(order) {
    const { orderId, customerInfo = {}, cartItems = [], total, totalItems } = order;
    const direccion = customerInfo?.direccion || {};

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
      <h2>Nuevo pedido #${orderId}</h2>

      <h3>Datos del cliente</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:16px;">
        <tbody>
          <tr><td><strong>Cliente</strong></td><td>${customerInfo?.cliente || '-'}</td></tr>
          <tr><td><strong>Razón social</strong></td><td>${customerInfo?.razonSocial || '-'}</td></tr>
          <tr><td><strong>CUIT</strong></td><td>${customerInfo?.cuit || '-'}</td></tr>
          <tr><td><strong>Contacto</strong></td><td>${customerInfo?.contacto || '-'}</td></tr>
          <tr><td><strong>Email</strong></td><td>${customerInfo?.email || '-'}</td></tr>
          <tr><td><strong>Teléfono</strong></td><td>${customerInfo?.telefono1 || '-'}</td></tr>
          <tr><td><strong>Dirección</strong></td>
            <td>
              ${direccion.calle || '-'} ${direccion.numero || ''}<br/>
              Piso: ${direccion.piso || '-'} &nbsp; Timbre: ${direccion.timbre || '-'}<br/>
              Entre calles: ${direccion.entreCalles || '-'}<br/>
              Localidad: ${direccion.localidad || '-'} &nbsp; Partido: ${direccion.partido || '-'}
            </td>
          </tr>
          <tr><td><strong>Horarios</strong></td><td>${customerInfo?.horarios || '-'}</td></tr>
          <tr><td><strong>Notas</strong></td><td>${customerInfo?.notas || '-'}</td></tr>
        </tbody>
      </table>

      <h3>Resumen del pedido</h3>
      <p><strong>Ítems:</strong> ${totalItems} &nbsp; | &nbsp; <strong>Total:</strong> ${fmt(total)}</p>

      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-top:8px;">
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
