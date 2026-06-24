function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '-';

    try {
        return new Intl.DateTimeFormat('es-AR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: process.env.TZ || 'America/Argentina/Buenos_Aires',
        }).format(date);
    } catch {
        return date.toISOString();
    }
}

function row(label, value) {
    return `
        <tr>
            <td style="padding:8px 10px; color:#555; width:180px;"><strong>${escapeHtml(label)}</strong></td>
            <td style="padding:8px 10px;">${escapeHtml(value || '-')}</td>
        </tr>
    `;
}

function buildNewCustomerAdminEmail({ customer = {}, createdBy = null } = {}) {
    return `
    <div style="font-family:Arial,Helvetica,sans-serif; color:#222;">
        <h2>Nuevo cliente dado de alta</h2>
        <p>Se creó correctamente un cliente desde el Admin.</p>

        <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; max-width:720px; margin-top:12px;">
            <tbody>
                ${row('Cliente', customer.cliente)}
                ${row('Razón social', customer.razonSocial)}
                ${row('Código de cliente', customer.customerCode)}
                ${row('Email', customer.email)}
                ${row('Teléfono', customer.telefono1)}
                ${row('CUIT', customer.cuit)}
                ${row('Fecha/hora de alta', formatDate(customer.createdAt))}
                ${createdBy ? row('Creado por', createdBy) : ''}
            </tbody>
        </table>

        <p style="margin-top:16px;">Este es un correo automático.</p>
    </div>
    `;
}

module.exports = {
    buildNewCustomerAdminEmail,
    formatDate,
};
