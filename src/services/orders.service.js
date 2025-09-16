const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const {
    sendOrderNotificationToAdmin,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {

    // Método para crear un nuevo pedido (CREATE)
    static async handleNewOrder(orderData) {
        // ... tu código actual para crear pedidos ...
        const orderDoc = await OrderModel.create({
            ...orderData,
            orderId: await generateOrderId(orderData.customerInfo?.cliente)
        });

        Promise.allSettled([
            sendOrderNotificationToAdmin(orderDoc),
            sendOrderConfirmationToCustomer(orderDoc)
        ]).then(results => {
            results.forEach((r, i) => {
                if (!r.success) {
                    console.error('[mail] Falló notificación', i, r.reason?.message || r.reason);
                }
            });
        }).catch(err => {
            console.error('[mail] Error inesperado en notificaciones:', err.message);
        });

        return {
            orderId: orderDoc.orderId,
            order: orderDoc
        };
    }

    // --- Nuevas funciones CRUD ---

    /**
     * Obtiene todos los pedidos (READ all)
     */
    static async getAllOrders() {
        return OrderModel.find({});
    }

    /**
     * Obtiene un pedido por su ID (READ one)
     */
    static async getOrderById(id) {
        return OrderModel.findById(id);
    }

    /**
     * Actualiza un pedido completo (UPDATE)
     */
    static async updateOrder(id, updatedData) {
        return OrderModel.findByIdAndUpdate(id, updatedData, { new: true });
    }

    /**
     * Elimina lógicamente un pedido (Soft Delete)
     */
    static async deleteOrder(id) {
        // Busca el pedido por ID y actualiza el campo de estado a 'deleted'
        return OrderModel.findByIdAndUpdate(id, { status: 'deleted' }, { new: true });
    }

    /**
     * Actualiza solo el estado de un pedido (UPDATE parcial)
     */
    static async updateOrderStatus(id, newStatus) {
        return OrderModel.findByIdAndUpdate(id, { status: newStatus }, { new: true });
    }
}

module.exports = OrdersService;