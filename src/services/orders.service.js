const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');

class OrdersService {
    static async handleNewOrder(orderData) {

        // Crear documento en DB
        const orderDoc = await OrderModel.create({
            ...orderData,
            orderId: await generateOrderId(orderData.customerInfo?.cliente)
        });

        // Aquí podrían agregarse futuras acciones (mail, WhatsApp, workflow)
        // await EmailService.sendOrderNotification(orderDoc);

        return {
            orderId: orderDoc.orderId,
            order: orderDoc
        };
    }
}

module.exports = OrdersService;
