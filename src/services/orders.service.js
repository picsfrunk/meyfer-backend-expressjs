const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const ScrapedProduct = require('../models/products.model');
const {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {
    /**
     * Transforma cartItems (del FE) en items normalizados
     * Recibe: [{ _id, nombre, precio, ... }, ...]
     * Retorna: [{ productId, quantity, priceAtPurchase }, ...]
     */
    static transformCartItemsToOrderItems(cartItems) {
        return cartItems.map(item => {
            // El producto está en item.productCartItem
            const product = item.productCartItem || item;

            return {
                product_id: product.product_id,
                quantity: item.qty || item.quantity || 1,
                priceAtPurchase: product.final_price || product.list_price || product.precio || 0
            };
        });
    }

    /**
     * Crea un nuevo pedido (normalizado)
     */
    static async handleNewOrder(orderData) {
        const normalizedItems = this.transformCartItemsToOrderItems(orderData.cartItems);
        console.log(normalizedItems)
        const orderDoc = await OrderModel.create({
            customerInfo: orderData.customerInfo,
            items: normalizedItems,
            total: orderData.total,
            totalItems: orderData.totalItems,
            orderId: await generateOrderId(orderData.customerInfo?.cliente)
        });

        // Notificaciones asíncronas
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
     * Obtiene todos los pedidos con productos poblados
     */
    static async getAllOrders(status, populate = true) {
        const filter = {};
        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',') };
            } else {
                filter.status = status;
            }
        }

        const orders = await OrderModel.find(filter).sort({ createdAt: -1 });

        if (!populate) {
            return orders;
        }

        for (const order of orders) {
            for (const item of order.items) {
                item.product = await ScrapedProduct.findOne({ product_id: item.product_id });
            }
        }

        return orders;
    }

    static async getOrderById(orderId, populate = true) {
        const order = await OrderModel.findOne({ orderId });

        if (!order || !populate) {
            return order;
        }

        const ProductModel = require('../models/products.model');

        for (const item of order.items) {
            item.product = await ProductModel.findOne({ product_id: item.product_id });
        }

        return order;
    }

    /**
     * Reconstruye el pedido completo (para emails, vistas detalladas, etc.)
     */
    static async getOrderWithFullDetails(orderId) {
        const order = await this.getOrderById(orderId, true);

        if (!order) {
            return null;
        }

        // Mapear items con info completa del producto
        const enrichedItems = order.items.map(item => ({
            product: item.productId,
            quantity: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
            subtotal: item.quantity * item.priceAtPurchase
        }));

        return {
            ...order.toObject(),
            items: enrichedItems
        };
    }

    /**
     * Actualiza un pedido completo
     */
    static async updateOrder(orderId, updatedData) {
        if (updatedData.cartItems) {
            updatedData.items = this.transformCartItemsToOrderItems(updatedData.cartItems);
            delete updatedData.cartItems;
        }

        return OrderModel.findOneAndUpdate(
            { orderId },
            updatedData,
            { new: true, runValidators: true }
        ).populate('items.productId');
    }

    /**
     * Elimina lógicamente un pedido
     */
    static async deleteOrder(orderId) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: 'deleted' },
            { new: true }
        );
    }

    /**
     * Actualiza solo el estado
     */
    static async updateOrderStatus(orderId, newStatus) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: newStatus },
            { new: true, runValidators: true }
        );
    }

    /**
     * Reenvía emails (necesita productos poblados)
     */
    static async resendOrderEmails(orderId, options = { admin: true, customer: false }) {
        const order = await this.getOrderById(orderId, true);

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
            target: i === 0 && options.admin ? 'admin' : 'customer',
            status: r.status,
            error: r.status === 'rejected' ? r.reason.message : null
        }));
    }
}

module.exports = OrdersService;