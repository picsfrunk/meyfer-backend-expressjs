function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getCustomerName(customer = {}) {
    return customer.cliente || customer.razonSocial || customer.contacto || 'cliente';
}

function buildCustomerWelcomeEmail({ customer = {}, storeUrl = '' } = {}) {
    const customerName = getCustomerName(customer);
    const customerCode = customer.customerCode || '-';

    return `
    <div style="font-family:Arial,Helvetica,sans-serif; background:#f6f7f9; padding:24px; color:#222;">
        <div style="max-width:680px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e8e8e8;">
            <div style="background:#1f2937; color:#ffffff; padding:24px;">
                <h1 style="margin:0; font-size:24px;">Ya podés realizar pedidos en Meyfer</h1>
                <p style="margin:8px 0 0; color:#d1d5db;">Tu cliente fue habilitado correctamente.</p>
            </div>

            <div style="padding:24px;">
                <p style="font-size:16px; margin:0 0 16px;">
                    Hola <strong>${escapeHtml(customerName)}</strong>,
                </p>
                <p style="font-size:16px; line-height:1.5; margin:0 0 16px;">
                    Ya tenés habilitado el acceso para realizar pedidos en la tienda Meyfer.
                </p>

                <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin:18px 0; background:#f9fafb; border:1px solid #eef0f3; border-radius:8px;">
                    <tbody>
                        <tr>
                            <td style="padding:12px; color:#555; width:170px;"><strong>Tienda</strong></td>
                            <td style="padding:12px;"><a href="${escapeHtml(storeUrl)}" style="color:#2563eb;">${escapeHtml(storeUrl)}</a></td>
                        </tr>
                        <tr>
                            <td style="padding:12px; color:#555;"><strong>Código de cliente</strong></td>
                            <td style="padding:12px; font-size:18px; font-weight:700;">${escapeHtml(customerCode)}</td>
                        </tr>
                    </tbody>
                </table>

                <p style="font-size:16px; line-height:1.5; margin:0;">
                    Usá ese código para identificarte al hacer un pedido.
                </p>
            </div>
        </div>
    </div>
    `;
}

module.exports = {
    buildCustomerWelcomeEmail,
    getCustomerName,
};
