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
                orderId: result.orderId,
                status: 'success',
                message: 'Pedido recibido correctamente'
            });
        } catch (err) {
            console.error('Error creando pedido:', err);
            res.status(500).json({ status: 'error', message: err.message });
        }
    }
}

module.exports = OrdersController;
