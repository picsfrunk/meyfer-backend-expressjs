// Helper de formato de moneda
const {sendOrderNotificationToAdmin} = require("../services/email.service");

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

module.exports = buildOrderHtml;