const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {

    static async handleNewOrder(orderData) {
        const orderDoc = await OrderModel.create({
            ...orderData,
            orderId: await generateOrderId(orderData.customerInfo?.cliente)
        });

        Promise.allSettled([
            sendOrderNotificationToAdmins(orderDoc),
            sendOrderConfirmationToCustomer(orderDoc)
        ]).then(results => {
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.error(
                        `[mail] Falló notificación ${i}:`,
                        r.reason?.message || r.reason
                    );
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

    /**
     * Obtiene todos los pedidos (READ all, con filtro opcional de estado)
     */
    static async getAllOrders(status) {
        const filter = {};
        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',') };
            } else {
                filter.status = status;
            }
        }
        return OrderModel.find(filter);
    }

    /**
     * Obtiene un pedido por su orderId (READ one)
     */
    static async getOrderById(orderId) {
        return OrderModel.findOne({ orderId });
    }

    /**
     * Actualiza un pedido completo (UPDATE)
     */
    static async updateOrder(orderId, updatedData) {
        return OrderModel.findOneAndUpdate({ orderId }, updatedData, { new: true });
    }

    /**
     * Elimina lógicamente un pedido (Soft Delete)
     */
    static async deleteOrder(orderId) {
        return OrderModel.findOneAndUpdate({ orderId }, { status: 'deleted' }, { new: true });
    }

    /**
     * Actualiza solo el estado de un pedido (UPDATE parcial)
     */
    static async updateOrderStatus(orderId, newStatus) {
        return OrderModel.findOneAndUpdate({ orderId }, { status: newStatus }, { new: true });
    }

    static async resendOrderEmails(orderId, options = { admin: true, customer: false }) {
        const order = await OrderModel.findOne({ orderId });
        if (!order) {
            const error = new Error('Pedido no encontrado');
            error.statusCode = 404;
            throw error;
        }

        const tasks = [];
        if (options.admin) tasks.push(sendOrderNotificationToAdmins(order));
        if (options.customer) tasks.push(sendOrderConfirmationToCustomer(order));

        const results = await Promise.allSettled(tasks);
        return results.map((r, i) => ({
            target: i === 0 ? 'admin' : 'customer',
            status: r.status,
            error: r.status === 'rejected' ? r.reason.message : null
        }));
    }
}

module.exports = OrdersService;