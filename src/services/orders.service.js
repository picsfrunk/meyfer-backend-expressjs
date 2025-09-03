const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const {sendOrderNotificationToAdmin,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {
    static async handleNewOrder(orderData) {

        // Crear documento en DB
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
}

module.exports = OrdersService;
