const Customer = require('../models/customer.model');

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

        try {
            const customer = await Customer.create(fields);
            return customer.toObject();
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
     * Actualiza un cliente por su _id de MongoDB.
     */
    static async updateCustomer(id, data) {
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
     * Elimina un cliente por su _id de MongoDB.
     */
    static async deleteCustomer(id) {
        return Customer.findByIdAndDelete(id).lean();
    }
}

module.exports = CustomersService;
