const Config = require('../models/config.model');
const AdminEmail = require('../models/admin.model');

exports.getProfitMargin = async () => {
    try {
        const config = await Config.findOne({ key: 'profitMargin' });
        if (!config) {
            const error = new Error('Profit margin no encontrado.');
            error.statusCode = 404;
            throw error;
        }
        return config.value;
    } catch (error) {
        console.error('Error en ConfigService al obtener profit margin:', error);
        throw error;
    }
};

exports.setProfitMargin = async (margin) => {
    if (typeof margin !== 'number') {
        const error = new Error('El margen debe ser un número');
        error.statusCode = 400;
        throw error;
    }

    try {
        const updated = await Config.findOneAndUpdate(
            { key: 'profitMargin' },
            { value: margin },
            { new: true, upsert: true }
        );
        return updated.value;
    } catch (error) {
        console.error('Error en ConfigService al actualizar profit margin:', error);
        throw error;
    }
};

exports.getLastUpdateDate = async () => {
    const configEntry = await Config.findOne({ key: 'last_update' });

    if (!configEntry) {
        return null;
    }

    return configEntry.value;
};

/**
 * Agrega un nuevo email de administrador o vendedor.
 * @param {string} email - Dirección de correo a registrar.
 * @param {string} [role='admin'] - Rol: 'admin' o 'seller'.
 */
exports.addAdminEmail = async (email, role = 'admin') => {
    if (!email || typeof email !== 'string') {
        const error = new Error('Email inválido');
        error.statusCode = 400;
        throw error;
    }

    try {
        return await AdminEmail.create({
            email,
            role
        });
    } catch (error) {
        console.error('Error al agregar email de admin:', error);
        if (error.code === 11000) {
            const dup = new Error('El email ya existe');
            dup.statusCode = 409;
            throw dup;
        }
        throw error;
    }
};

/**
 * Devuelve todos los emails activos.
 */
exports.listActiveAdminEmails = async () => {
    try {
        const docs = await AdminEmail.find({ active: true }).lean();
        return docs.map(d => d.email);
    } catch (error) {
        console.error('Error al listar emails de admin:', error);
        throw error;
    }
};

/**
 * (Opcional) Desactiva un email sin borrarlo de la DB.
 */
exports.deactivateAdminEmail = async (email) => {
    try {
        const updated = await AdminEmail.findOneAndUpdate(
            { email },
            { active: false },
            { new: true }
        );
        if (!updated) {
            const error = new Error('Email no encontrado');
            error.statusCode = 404;
            throw error;
        }
        return updated;
    } catch (error) {
        console.error('Error al desactivar email de admin:', error);
        throw error;
    }
};