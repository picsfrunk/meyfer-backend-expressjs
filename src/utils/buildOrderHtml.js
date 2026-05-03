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

function getProductName(product, productId) {
    return product?.display_name
        ?? product?.title
        ?? product?.name
        ?? product?.descripcion
        ?? productId
        ?? '-';
}

function normalizeItems(order) {
    if (Array.isArray(order?.items) && order.items.length > 0) {
        return order.items.map(item => {
            const product = item.product || item.productCartItem || {};
            const productId = item.product_id ?? product.product_id;
            const quantity = Number(item.quantity ?? item.qty ?? 0);
            const price = Number(item.priceAtPurchase ?? product.priceAtPurchase ?? product.final_price ?? product.list_price ?? 0);

            return {
                productId,
                name: getProductName(product, productId),
                quantity,
                price,
                subtotal: quantity * price
            };
        });
    }

    return (order?.cartItems || []).map(ci => {
        const product = ci.productCartItem || ci.product || {};
        const productId = ci.product_id ?? product.product_id;
        const quantity = Number(ci.qty ?? ci.quantity ?? 0);
        const price = Number(ci.priceAtPurchase ?? ci.unitPrice ?? product.priceAtPurchase ?? product.final_price ?? product.list_price ?? product.precio ?? 0);

        return {
            productId,
            name: getProductName(product, productId),
            quantity,
            price,
            subtotal: quantity * price
        };
    });
}

function buildOrderHtml(order) {
    const { orderId, customerInfo = {}, customerNote = '', delivery = {}, total, totalItems, extraCharge = 0 } = order;
    const direccion = delivery?.address || customerInfo?.direccion || {};
    const items = normalizeItems(order);
    const calculatedItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const calculatedProductsTotal = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
    const normalizedTotal = Number(total);
    const normalizedExtraCharge = Number(extraCharge ?? 0);
    const displayTotalItems = totalItems ?? calculatedItems;
    const productsTotal = Number.isFinite(normalizedTotal)
        ? normalizedTotal - normalizedExtraCharge
        : calculatedProductsTotal;

    const itemsHtml = items.map(item => {
        return `
      <tr>
        <td>${item.productId ?? '-'}</td>
        <td>${item.name}</td>
        <td>${item.quantity || '-'}</td>
        <td>${fmt(item.price)}</td>
        <td>${fmt(item.subtotal)}</td>
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
          <tr><td><strong>Contacto entrega</strong></td><td>${delivery?.contactName || '-'}</td></tr>
          <tr><td><strong>Teléfono entrega</strong></td><td>${delivery?.contactPhone || '-'}</td></tr>
          <tr><td><strong>Dirección</strong></td>
            <td>
              ${direccion.calle || '-'} ${direccion.numero || ''}<br/>
              Piso: ${direccion.piso || '-'} &nbsp; Timbre: ${direccion.timbre || '-'}<br/>
              Entre calles: ${direccion.entreCalles || '-'}<br/>
              Localidad: ${direccion.localidad || '-'} &nbsp; Partido: ${direccion.partido || '-'}
            </td>
          </tr>
          <tr><td><strong>Horarios</strong></td><td>${delivery?.schedule || customerInfo?.horarios || '-'}</td></tr>
          <tr><td><strong>Observación del cliente</strong></td><td>${customerNote || '-'}</td></tr>
        </tbody>
      </table>

      <h3>Resumen del pedido</h3>

      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-top:8px;">
        <thead>
          <tr>
            <th style="text-align:left">ID</th>
            <th style="text-align:left">Producto</th>
            <th style="text-align:left">Cant.</th>
            <th style="text-align:left">Precio</th>
            <th style="text-align:left">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right"><strong>Cantidad de ítems</strong></td>
            <td><strong>${displayTotalItems}</strong></td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right"><strong>Subtotal productos</strong></td>
            <td><strong>${fmt(productsTotal)}</strong></td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right"><strong>Recargo</strong></td>
            <td><strong>${fmt(extraCharge)}</strong></td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right"><strong>Total</strong></td>
            <td><strong>${fmt(total)}</strong></td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top:16px;">Este es un correo automático.</p>
    </div>
  `;
}

module.exports = buildOrderHtml;
