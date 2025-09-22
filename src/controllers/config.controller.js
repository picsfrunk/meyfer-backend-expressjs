const ConfigService = require('../services/config.service');

exports.getProfitMargin = async (req, res) => {
    try {
        const profitMargin = await ConfigService.getProfitMargin();
        res.json({ margin: profitMargin });
    } catch (error) {
        console.error('Error al obtener profit margin:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error del servidor' });
    }
};

exports.setProfitMargin = async (req, res) => {
    const { margin } = req.body;
    try {
        const updatedMargin = await ConfigService.setProfitMargin(margin);
        res.json({ message: 'Profit margin actualizado', margin: updatedMargin });
    } catch (error) {
        console.error('Error al actualizar profit margin:', error);
        res.status(error.statusCode || 400).json({ message: error.message || 'Error del servidor' });
    }
};

exports.getLastUpdateDate = async (req, res) => {
    try {
        const lastUpdate = await ConfigService.getLastUpdateDate();

        if (!lastUpdate) {
            return res.status(404).json({ message: 'No hay registro de actualización aún' });
        }

        res.json({ lastUpdate });
    } catch (error) {
        console.error('[getLastUpdateDate] Error:', error);
        res.status(500).json({ message: 'Error al obtener la fecha de actualización' });
    }
};

/**
 * GET /config/admin-emails
 * Devuelve la lista de emails de administradores/vendedores activos.
 */
exports.listAdminEmails = async (_req, res) => {
    try {
        const emails = await ConfigService.listActiveAdminEmails();
        res.json({ emails });
    } catch (error) {
        console.error('Error al listar admin emails:', error);
        res.status(error.statusCode || 500).json({ message: error.message || 'Error del servidor' });
    }
};

/**
 * POST /config/admin-emails
 * Agrega un nuevo email a la lista de administradores/vendedores.
 * Body: { email: string, role?: 'admin' | 'seller' }
 */
exports.addAdminEmail = async (req, res) => {
    const { email, role } = req.body;
    try {
        const doc = await ConfigService.addAdminEmail(email, role);
        res.status(201).json({
            message: 'Email de administrador agregado',
            email: doc.email,
            role: doc.role,
            active: doc.active
        });
    } catch (error) {
        console.error('Error al agregar admin email:', error);
        res.status(error.statusCode || 400).json({ message: error.message || 'Error del servidor' });
    }
};

/**
 * PATCH /config/admin-emails/deactivate
 * Desactiva un email (no lo borra).
 * Body: { email: string }
 */
exports.deactivateAdminEmail = async (req, res) => {
    const { email } = req.body;
    try {
        const updated = await ConfigService.deactivateAdminEmail(email);
        res.json({
            message: 'Email desactivado correctamente',
            email: updated.email,
            active: updated.active
        });
    } catch (error) {
        console.error('Error al desactivar admin email:', error);
        res.status(error.statusCode || 400).json({ message: error.message || 'Error del servidor' });
    }
};
