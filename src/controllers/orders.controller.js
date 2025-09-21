const OrdersService = require('../services/orders.service');

class OrdersController {
    /**
     * Crea un nuevo pedido
     */
    static async createOrder(req, res) {
        try {
            const orderData = req.body;
            const result = await OrdersService.handleNewOrder(orderData);
            res.status(201).json({
                orderId: result.orderId || 'id Error',
                status: 'success',
                message: 'Pedido recibido correctamente'
            });
        } catch (err) {
            console.error('Error creando pedido:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    /**
     * Obtiene todos los pedidos (opcionalmente filtrados por estado)
     */
    static async getAllOrders(req, res) {
        try {
            const { status } = req.query;
            const orders = await OrdersService.getAllOrders(status);
            res.status(200).json(orders);
        } catch (err) {
            console.error('Error obteniendo pedidos:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }


    /**
     * Obtiene un pedido por su ID
     */
    static async getOrderById(req, res) {
        try {
            const { id } = req.params;
            const order = await OrdersService.getOrderById(id);
            if (!order) {
                return res.status(404).json({ message: 'Pedido no encontrado' });
            }
            res.status(200).json(order);
        } catch (err) {
            console.error('Error obteniendo pedido por ID:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    /**
     * Actualiza un pedido completo
     */
    static async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const updatedData = req.body;
            const updatedOrder = await OrdersService.updateOrder(id, updatedData);
            if (!updatedOrder) {
                return res.status(404).json({ message: 'Pedido no encontrado' });
            }
            res.status(200).json({ status: 'success', message: 'Pedido actualizado', order: updatedOrder });
        } catch (err) {
            console.error('Error actualizando pedido:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    /**
     * Elimina un pedido
     */
    static async deleteOrder(req, res) {
        try {
            const { id } = req.params;
            const deleted = await OrdersService.deleteOrder(id);
            if (!deleted) {
                return res.status(404).json({ message: 'Pedido no encontrado' });
            }
            res.status(200).json({ status: 'success', message: 'Pedido eliminado' });
        } catch (err) {
            console.error('Error eliminando pedido:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    /**
     * Actualiza el estado de un pedido
     */
    static async updateOrderStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            if (!status) {
                return res.status(400).json({ message: 'El estado del pedido es requerido' });
            }
            const updatedOrder = await OrdersService.updateOrderStatus(id, status);
            if (!updatedOrder) {
                return res.status(404).json({ message: 'Pedido no encontrado' });
            }
            res.status(200).json({ status: 'success', message: 'Estado del pedido actualizado', order: updatedOrder });
        } catch (err) {
            console.error('Error actualizando estado del pedido:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }

    static async resendOrderEmails(req, res) {
        const {orderId} = req.params;
        const {
            admin = true,
            customer = false
        } = req.body || {};

        try {
            const result = await OrdersService.resendOrderEmails(orderId, {
                admin,
                customer
            });
            res.json({
                message: 'Reenvío de emails completado',
                result
            });
        } catch (error) {
            console.error('[orders.controller] Error reenvío de emails:', error);
            res.status(error.statusCode || 500).json({
                message: error.message || 'Error del servidor'
            });
        }
    };
}

module.exports = OrdersController;