const {generateOrderId} = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');

class OrdersService {
    static async handleNewOrder(orderData) {
        // Generar order_id personalizado
        const order_id = await generateOrderId(orderData.customerInfo?.cliente);

        // Crear documento en DB
        const orderDoc = await OrderModel.create({
            ...orderData,
            order_id: order_id
        });

        // Aquí podrían agregarse futuras acciones (mail, WhatsApp, workflow)
        // await EmailService.sendOrderNotification(orderDoc);

        return {
            order_id: orderDoc.order_id,
            order: orderDoc
        };
    }
}

module.exports = OrdersService;
