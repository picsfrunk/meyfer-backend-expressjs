const Customer = require('../models/customer.model');

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function randomChars(n) {
    let result = '';
    for (let i = 0; i < n; i++) {
        result += CHARS[Math.floor(Math.random() * CHARS.length)];
    }
    return result;
}

function generateCustomerCode(cliente, cuit) {
    const normalized = (cliente || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    const prefix = normalized.slice(0, 2).padEnd(2, 'X');

    let cuitPart;
    if (cuit) {
        const digits = cuit.replace(/\D/g, '');
        cuitPart = digits.slice(-2).padStart(2, '0');
    } else {
        cuitPart = randomChars(2);
    }

    const suffix = randomChars(2);
    return prefix + cuitPart + suffix;
}

class CustomersService {

    /**
     * Extrae los campos del cliente a partir del objeto customerInfo
     * que llega con el pedido.
     */
    static _buildCustomerFields(customerInfo = {}) {
        const fields = {
            cliente:     customerInfo.cliente     || '',
            razonSocial: customerInfo.razonSocial || '',
            cuit:        customerInfo.cuit        || '',
            contacto:    customerInfo.contacto    || '',
            email:       (customerInfo.email || '').toLowerCase().trim(),
            telefono1:   customerInfo.telefono1   || '',
            horarios:    customerInfo.horarios    || '',
            notas:       customerInfo.notas       || '',
            direccion:   {
                calle:       customerInfo.direccion?.calle       || '',
                numero:      customerInfo.direccion?.numero      || '',
                piso:        customerInfo.direccion?.piso        || '',
                timbre:      customerInfo.direccion?.timbre      || '',
                entreCalles: customerInfo.direccion?.entreCalles || '',
                localidad:   customerInfo.direccion?.localidad   || '',
                partido:     customerInfo.direccion?.partido     || ''
            }
        };

        return fields;
    }

    /**
     * Construye el filtro para encontrar un cliente existente.
     * Prioridad: CUIT → email.
     */
    static _buildLookupFilter(fields) {
        if (fields.cuit) return { cuit: fields.cuit };
        if (fields.email) return { email: fields.email };
        return null;
    }

    /**
     * Inserta o actualiza un cliente a partir del customerInfo de un pedido.
     * Devuelve el documento del cliente (lean).
     * Si no hay identificador único (CUIT ni email), crea un registro nuevo.
     */
    static async upsertFromOrderInfo(customerInfo = {}) {
        const fields = this._buildCustomerFields(customerInfo);

        if (!fields.cliente) {
            return null;
        }

        const filter = this._buildLookupFilter(fields);

        if (!filter) {
            // Sin identificador único → crear nuevo registro
            return Customer.create(fields).then(doc => doc.toObject());
        }

        const customer = await Customer.findOneAndUpdate(
            filter,
            { $set: fields },
            { new: true, upsert: true, runValidators: true }
        ).lean();

        return customer;
    }

    /**
     * Devuelve todos los clientes.
     */
    static async getAllCustomers() {
        return Customer.find().sort({ createdAt: -1 }).lean();
    }

    /**
     * Devuelve un cliente por su _id de MongoDB.
     */
    static async getCustomerById(id) {
        return Customer.findById(id).lean();
    }

    /**
     * Crea un cliente manualmente (desde admin).
     */
    static async createCustomer(data) {
        const fields = this._buildCustomerFields(data);

        if (!fields.cliente) {
            const error = new Error('El campo "cliente" es requerido');
            error.statusCode = 400;
            throw error;
        }

        const MAX_ATTEMPTS = 5;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const customerCode = generateCustomerCode(fields.cliente, fields.cuit);
            const customer = new Customer({ ...fields, customerCode });
            try {
                await customer.save();
                return customer.toObject();
            } catch (err) {
                if (err.code === 11000) {
                    if ((err.keyPattern || {}).customerCode) {
                        if (attempt === MAX_ATTEMPTS - 1) {
                            const genError = new Error('No se pudo generar un código único para el cliente');
                            genError.statusCode = 500;
                            throw genError;
                        }
                        continue;
                    }
                    const dupError = new Error('Ya existe un cliente con ese CUIT o email');
                    dupError.statusCode = 409;
                    throw dupError;
                }
                throw err;
            }
        }
    }

    /**
     * Actualiza un cliente por su _id de MongoDB.
     */
    static async updateCustomer(id, data) {
        delete data.customerCode;
        const fields = this._buildCustomerFields(data);

        try {
            const updated = await Customer.findByIdAndUpdate(
                id,
                { $set: fields },
                { new: true, runValidators: true }
            ).lean();

            return updated;
        } catch (err) {
            if (err.code === 11000) {
                const dupError = new Error('Ya existe un cliente con ese CUIT o email');
                dupError.statusCode = 409;
                throw dupError;
            }
            throw err;
        }
    }

    /**
     * Regenera el customerCode de un cliente existente.
     * Devuelve el nuevo código o null si el cliente no existe.
     */
    static async regenerateCode(id) {
        const customer = await Customer.findById(id);
        if (!customer) return null;

        const MAX_ATTEMPTS = 5;
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const customerCode = generateCustomerCode(customer.cliente, customer.cuit);
            customer.customerCode = customerCode;
            try {
                await customer.save();
                return customerCode;
            } catch (err) {
                if (err.code === 11000 && (err.keyPattern || {}).customerCode) {
                    if (attempt === MAX_ATTEMPTS - 1) {
                        const genError = new Error('No se pudo generar un código único para el cliente');
                        genError.statusCode = 500;
                        throw genError;
                    }
                    continue;
                }
                throw err;
            }
        }
    }

    /**
     * Elimina un cliente por su _id de MongoDB.
     */
    static async deleteCustomer(id) {
        return Customer.findByIdAndDelete(id).lean();
    }
}

module.exports = CustomersService;
