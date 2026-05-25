const { LOCAL_CURRENCY = 'ARS' } = process.env;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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

function buildAddressHtml(address = {}) {
    const firstLine = `${address.calle || '-'} ${address.numero || ''}`.trim();
    const details = [
        address.piso ? `Piso: ${address.piso}` : null,
        address.timbre ? `Timbre: ${address.timbre}` : null,
        address.entreCalles ? `Entre calles: ${address.entreCalles}` : null,
        address.localidad ? `Localidad: ${address.localidad}` : null,
        address.partido ? `Partido: ${address.partido}` : null,
    ].filter(Boolean);

    return `
        <div>${escapeHtml(firstLine || '-')}</div>
        ${details.map(detail => `<div style="color:#555; font-size:13px;">${escapeHtml(detail)}</div>`).join('')}
    `;
}

function buildCustomerOrderConfirmationHtml(order) {
    const {
        orderId,
        customerInfo = {},
        customerNote = '',
        delivery = {},
        total,
        totalItems,
        extraCharge = 0
    } = order || {};

    const items = normalizeItems(order);
    const address = delivery?.address || customerInfo?.direccion || {};
    const calculatedItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const calculatedProductsTotal = items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
    const normalizedTotal = Number(total);
    const normalizedExtraCharge = Number(extraCharge ?? 0);
    const productsTotal = Number.isFinite(normalizedTotal)
        ? normalizedTotal - normalizedExtraCharge
        : calculatedProductsTotal;
    const displayTotal = Number.isFinite(normalizedTotal)
        ? normalizedTotal
        : calculatedProductsTotal + normalizedExtraCharge;
    const displayTotalItems = totalItems ?? calculatedItems;

    const itemsHtml = items.length
        ? items.map(item => `
            <tr>
                <td style="padding:10px; border-bottom:1px solid #eee; color:#555;">${escapeHtml(item.productId ?? '-')}</td>
                <td style="padding:10px; border-bottom:1px solid #eee;">${escapeHtml(item.name)}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">${escapeHtml(item.quantity || '-')}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${escapeHtml(fmt(item.price))}</td>
                <td style="padding:10px; border-bottom:1px solid #eee; text-align:right; font-weight:600;">${escapeHtml(fmt(item.subtotal))}</td>
            </tr>
        `).join('')
        : `
            <tr>
                <td colspan="5" style="padding:12px; text-align:center; color:#777; border-bottom:1px solid #eee;">
                    No se encontraron productos detallados para este pedido.
                </td>
            </tr>
        `;

    return `
    <div style="font-family:Arial,Helvetica,sans-serif; background:#f6f7f9; padding:24px; color:#222;">
        <div style="max-width:720px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e8e8e8;">
            <div style="background:#1f2937; color:#ffffff; padding:24px;">
                <h1 style="margin:0; font-size:24px;">¡Gracias por tu pedido!</h1>
                <p style="margin:8px 0 0; color:#d1d5db;">Recibimos tu solicitud y nos vamos a contactar para coordinar la entrega.</p>
            </div>

            <div style="padding:24px;">
                <p style="font-size:16px; margin:0 0 16px;">
                    Hola <strong>${escapeHtml(customerInfo?.cliente || customerInfo?.contacto || 'cliente')}</strong>,
                    este es el resumen de tu pedido <strong>#${escapeHtml(orderId || '-')}</strong>.
                </p>

                <div style="display:block; margin:18px 0; padding:16px; background:#f9fafb; border:1px solid #eef0f3; border-radius:8px;">
                    <h2 style="font-size:18px; margin:0 0 12px;">Datos de entrega</h2>
                    <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
                        <tbody>
                            <tr>
                                <td style="padding:6px 0; color:#555; width:160px;"><strong>Contacto</strong></td>
                                <td style="padding:6px 0;">${escapeHtml(delivery?.contactName || customerInfo?.contacto || '-')}</td>
                            </tr>
                            <tr>
                                <td style="padding:6px 0; color:#555;"><strong>Teléfono</strong></td>
                                <td style="padding:6px 0;">${escapeHtml(delivery?.contactPhone || customerInfo?.telefono1 || '-')}</td>
                            </tr>
                            <tr>
                                <td style="padding:6px 0; color:#555; vertical-align:top;"><strong>Dirección</strong></td>
                                <td style="padding:6px 0;">${buildAddressHtml(address)}</td>
                            </tr>
                            <tr>
                                <td style="padding:6px 0; color:#555;"><strong>Horario</strong></td>
                                <td style="padding:6px 0;">${escapeHtml(delivery?.schedule || customerInfo?.horarios || '-')}</td>
                            </tr>
                            ${customerNote ? `
                            <tr>
                                <td style="padding:6px 0; color:#555; vertical-align:top;"><strong>Observación</strong></td>
                                <td style="padding:6px 0;">${escapeHtml(customerNote)}</td>
                            </tr>` : ''}
                        </tbody>
                    </table>
                </div>

                <h2 style="font-size:18px; margin:24px 0 12px;">Productos</h2>
                <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; border:1px solid #eee;">
                    <thead>
                        <tr style="background:#f3f4f6;">
                            <th style="padding:10px; text-align:left; color:#555;">ID</th>
                            <th style="padding:10px; text-align:left; color:#555;">Producto</th>
                            <th style="padding:10px; text-align:center; color:#555;">Cant.</th>
                            <th style="padding:10px; text-align:right; color:#555;">Precio</th>
                            <th style="padding:10px; text-align:right; color:#555;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4" style="padding:10px; text-align:right; color:#555;">Cantidad de ítems</td>
                            <td style="padding:10px; text-align:right; font-weight:600;">${escapeHtml(displayTotalItems)}</td>
                        </tr>
                        <tr>
                            <td colspan="4" style="padding:10px; text-align:right; color:#555;">Subtotal productos</td>
                            <td style="padding:10px; text-align:right; font-weight:600;">${escapeHtml(fmt(productsTotal))}</td>
                        </tr>
                        ${normalizedExtraCharge > 0 ? `
                        <tr>
                            <td colspan="4" style="padding:10px; text-align:right; color:#555;">Recargo</td>
                            <td style="padding:10px; text-align:right; font-weight:600;">${escapeHtml(fmt(normalizedExtraCharge))}</td>
                        </tr>` : ''}
                        <tr style="background:#f9fafb;">
                            <td colspan="4" style="padding:12px; text-align:right; font-size:16px;"><strong>Total</strong></td>
                            <td style="padding:12px; text-align:right; font-size:16px;"><strong>${escapeHtml(fmt(displayTotal))}</strong></td>
                        </tr>
                    </tfoot>
                </table>

                <p style="margin:24px 0 0; color:#555; line-height:1.5;">
                    Este correo confirma que recibimos tu pedido. El equipo de MeyFer revisará la solicitud y se contactará para confirmar disponibilidad, forma de pago y entrega.
                </p>
            </div>
        </div>
    </div>
    `;
}

module.exports = buildCustomerOrderConfirmationHtml;
