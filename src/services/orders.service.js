const OrderModel = require('../models/order.model'); // MongoDB model
// Aquí luego inyectar otros servicios: emailService, whatsappService, etc.

class OrdersService {
    /**
     * Maneja un pedido nuevo y orquesta todas las acciones necesarias
     */
    static async handleNewOrder(orderData) {
        // 1️⃣ Guardar en la base de datos
        const orderDoc = await OrderModel.create(orderData);

        // 2️⃣ Acciones adicionales (simuladas)
        // await EmailService.sendOrderNotification(orderDoc);
        // await WhatsAppService.sendOrderNotification(orderDoc);
        // await OtherService.triggerWorkflow(orderDoc);

        return {
            orderId: orderDoc._id.toString(),
            order: orderDoc
        };
    }

    // Luego podés agregar métodos para:
    // static async getAllOrders() {}
    // static async getOrderById(id) {}
}

module.exports = OrdersService;
