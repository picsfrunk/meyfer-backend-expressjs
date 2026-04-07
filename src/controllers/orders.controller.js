const OrdersService = require('../services/orders.service');

class OrdersController {
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
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async getAllOrders(req, res) {
        try {
            const { status, populate = 'true' } = req.query;
            const shouldPopulate = populate === 'true';

            const orders = await OrdersService.getAllOrders(status, shouldPopulate);
            res.status(200).json(orders);
        } catch (err) {
            console.error('Error obteniendo pedidos:', err);
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async getOrderById(req, res) {
        try {
            const { id } = req.params;
            const { populate = 'true' } = req.query;
            const shouldPopulate = populate === 'true';

            const order = await OrdersService.getOrderById(id, shouldPopulate);

            if (!order) {
                return res.status(404).json({
                    message: 'Pedido no encontrado'
                });
            }

            res.status(200).json(order);
        } catch (err) {
            console.error('Error obteniendo pedido por ID:', err);
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async updateOrder(req, res) {
        try {
            const { id } = req.params;
            const updatedData = req.body;

            const updatedOrder = await OrdersService.updateOrder(id, updatedData);

            if (!updatedOrder) {
                return res.status(404).json({
                    message: 'Pedido no encontrado'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Pedido actualizado',
                order: updatedOrder
            });
        } catch (err) {
            console.error('Error actualizando pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async updateOrderPricing(req, res) {
        try {
            const { id } = req.params;
            const pricingData = req.body;
            const updatedOrder = await OrdersService.updateOrderPricing(id, pricingData);

            if (!updatedOrder) {
                return res.status(404).json({
                    message: 'Pedido no encontrado'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Precios del pedido actualizados',
                order: updatedOrder
            });
        } catch (err) {
            console.error('Error actualizando precios del pedido:', err);
            res.status(err.statusCode || 500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async deleteOrder(req, res) {
        try {
            const { id } = req.params;
            const deleted = await OrdersService.deleteOrder(id);

            if (!deleted) {
                return res.status(404).json({
                    message: 'Pedido no encontrado'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Pedido eliminado'
            });
        } catch (err) {
            console.error('Error eliminando pedido:', err);
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async updateOrderStatus(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const { statuses } = OrdersService.getOrderStatuses();

            if (!status) {
                return res.status(400).json({
                    message: 'El estado del pedido es requerido'
                });
            }

            if (!statuses.includes(status)) {
                return res.status(400).json({
                    message: 'Estado de pedido no válido',
                    allowedStatuses: statuses
                });
            }

            const updatedOrder = await OrdersService.updateOrderStatus(id, status);

            if (!updatedOrder) {
                return res.status(404).json({
                    message: 'Pedido no encontrado'
                });
            }

            res.status(200).json({
                status: 'success',
                message: 'Estado del pedido actualizado',
                order: updatedOrder
            });
        } catch (err) {
            console.error('Error actualizando estado del pedido:', err);
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async getOrderStatuses(req, res) {
        try {
            const result = OrdersService.getOrderStatuses();
            res.status(200).json(result);
        } catch (err) {
            console.error('Error obteniendo estados de pedidos:', err);
            res.status(500).json({
                status: 'error',
                message: err.message
            });
        }
    }

    static async resendOrderEmails(req, res) {
        const { orderId } = req.params;
        const { admin = true, customer = false } = req.body || {};

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
    }
}

module.exports = OrdersController;
