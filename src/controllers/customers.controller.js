const CustomersService = require('../services/customers.service');

class CustomersController {

    static async getAllCustomers(req, res) {
        try {
            const customers = await CustomersService.getAllCustomers();
            res.status(200).json(customers);
        } catch (err) {
            console.error('[customers] Error obteniendo clientes:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    static async getCustomerById(req, res) {
        try {
            const customer = await CustomersService.getCustomerById(req.params.id);
            if (!customer) {
                return res.status(404).json({ message: 'Cliente no encontrado' });
            }
            res.status(200).json(customer);
        } catch (err) {
            console.error('[customers] Error obteniendo cliente:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    static async createCustomer(req, res) {
        try {
            const customer = await CustomersService.createCustomer(req.body, {
                createdBy: req.user?.username || req.user?.email || null,
            });
            res.status(201).json({ status: 'success', customer });
        } catch (err) {
            console.error('[customers] Error creando cliente:', err);
            res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
        }
    }

    static async updateCustomer(req, res) {
        try {
            const updated = await CustomersService.updateCustomer(req.params.id, req.body);
            if (!updated) {
                return res.status(404).json({ message: 'Cliente no encontrado' });
            }
            res.status(200).json({ status: 'success', customer: updated });
        } catch (err) {
            console.error('[customers] Error actualizando cliente:', err);
            res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
        }
    }

    static async deleteCustomer(req, res) {
        try {
            const deleted = await CustomersService.deleteCustomer(req.params.id);
            if (!deleted) {
                return res.status(404).json({ message: 'Cliente no encontrado' });
            }
            res.status(200).json({ status: 'success', message: 'Cliente eliminado' });
        } catch (err) {
            console.error('[customers] Error eliminando cliente:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    static async regenerateCode(req, res) {
        try {
            const customerCode = await CustomersService.regenerateCode(req.params.id);
            if (customerCode === null) {
                return res.status(404).json({ message: 'Cliente no encontrado' });
            }
            res.status(200).json({ status: 'success', customerCode });
        } catch (err) {
            console.error('[customers] Error regenerando código:', err);
            res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
        }
    }
}

module.exports = CustomersController;
