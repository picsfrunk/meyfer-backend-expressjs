const { LOCAL_CURRENCY = 'ARS' } = process.env;

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

function normalizeOrderItems({ cartItems = [], items = [] }) {
    if (Array.isArray(cartItems) && cartItems.length > 0) {
        return cartItems.map(ci => {
            const p = ci.productCartItem || {};
            return {
                productId: p.product_id ?? ci.product_id ?? '-',
                productName: p.display_name ?? p.title ?? p.name ?? p.product_id ?? ci.product_id ?? '-',
                quantity: ci.qty ?? ci.quantity ?? '-',
                price: ci.priceAtPurchase ?? ci.unitPrice ?? p.final_price ?? p.list_price ?? 0
            };
        });
    }

    if (Array.isArray(items) && items.length > 0) {
        return items.map(item => {
            const p = item.product || {};
            return {
                productId: item.product_id ?? p.product_id ?? '-',
                productName: p.display_name ?? p.title ?? p.name ?? item.product_id ?? '-',
                quantity: item.quantity ?? item.qty ?? '-',
                price: item.priceAtPurchase ?? item.unitPrice ?? p.final_price ?? p.list_price ?? 0
            };
        });
    }

    return [];
}

function buildOrderHtml(order) {
    const {
        orderId,
        customerInfo = {},
        delivery = {},
        cartItems = [],
        items = [],
        total,
        totalItems,
        extraCharge = 0
    } = order;

    const direccion = delivery?.address || customerInfo?.direccion || {};
    const schedule = delivery?.schedule || customerInfo?.horarios || '-';
    const deliveryContactName = delivery?.contactName || customerInfo?.contacto || '-';
    const deliveryContactPhone = delivery?.contactPhone || customerInfo?.telefono1 || '-';

    const normalizedItems = normalizeOrderItems({ cartItems, items });

    const itemsHtml = normalizedItems.length > 0
        ? normalizedItems.map(item => `
      <tr>
        <td>${item.productId}</td>
        <td>${item.productName}</td>
        <td>${item.quantity}</td>
        <td>${fmt(item.price)}</td>
      </tr>
    `).join('')
        : `
      <tr>
        <td colspan="4" style="text-align:center; color:#777;">Sin productos disponibles</td>
      </tr>
    `;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif">
      <h2>Nuevo pedido #${orderId}</h2>

      <h3>Datos del cliente</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:16px;">
        <tbody>
          <tr><td><strong>Cliente</strong></td><td>${customerInfo?.cliente || '-'}</td></tr>
          <tr><td><strong>Razón social</strong></td><td>${customerInfo?.razonSocial || '-'}</td></tr>
          <tr><td><strong>CUIT</strong></td><td>${customerInfo?.cuit || '-'}</td></tr>
          <tr><td><strong>Contacto cliente</strong></td><td>${customerInfo?.contacto || '-'}</td></tr>
          <tr><td><strong>Email</strong></td><td>${customerInfo?.email || '-'}</td></tr>
          <tr><td><strong>Teléfono cliente</strong></td><td>${customerInfo?.telefono1 || '-'}</td></tr>
        </tbody>
      </table>

      <h3>Datos de entrega</h3>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:16px;">
        <tbody>
          <tr><td><strong>Contacto entrega</strong></td><td>${deliveryContactName}</td></tr>
          <tr><td><strong>Teléfono entrega</strong></td><td>${deliveryContactPhone}</td></tr>
          <tr><td><strong>Dirección</strong></td>
            <td>
              ${direccion.calle || '-'} ${direccion.numero || ''}<br/>
              Piso: ${direccion.piso || '-'} &nbsp; Timbre: ${direccion.timbre || '-'}<br/>
              Entre calles: ${direccion.entreCalles || '-'}<br/>
              Localidad: ${direccion.localidad || '-'} &nbsp; Partido: ${direccion.partido || '-'}
            </td>
          </tr>
          <tr><td><strong>Horario de entrega</strong></td><td>${schedule}</td></tr>
          <tr><td><strong>Notas</strong></td><td>${customerInfo?.notas || '-'}</td></tr>
        </tbody>
      </table>

      <h3>Resumen del pedido</h3>
      <p>
        <strong>Ítems:</strong> ${totalItems ?? normalizedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
        &nbsp; | &nbsp; <strong>Recargo extra:</strong> ${fmt(extraCharge)}
        &nbsp; | &nbsp; <strong>Total:</strong> ${fmt(total)}
      </p>

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
