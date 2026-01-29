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
     */
    static transformCartItemsToOrderItems(cartItems) {
        return cartItems.map(item => {
            const product = item.productCartItem || item;

            return {
                product_id: product.product_id,
                quantity: item.qty || item.quantity || 1,
                priceAtPurchase: product.final_price || product.list_price || product.precio || 0
            };
        });
    }

    /**
     * Transforma items normalizados (de DB) al formato que espera el frontend
     * Convierte: { product_id, quantity, priceAtPurchase, product: {...} }
     * A: { qty, productCartItem: {...} }
     */
    static transformItemsToCartItems(items) {
        return items.map(item => ({
            qty: item.quantity,
            productCartItem: item.product || {}
        }));
    }

    /**
     * Crea un nuevo pedido (normalizado)
     */
    static async handleNewOrder(orderData) {
        const normalizedItems = this.transformCartItemsToOrderItems(orderData.cartItems);

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

        // ✨ .lean() convierte documentos Mongoose a objetos JavaScript planos
        const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).lean();

        if (!populate) {
            return orders;
        }

        // Poblar productos manualmente y transformar al formato del frontend
        for (const order of orders) {
            for (const item of order.items) {
                const product = await ScrapedProduct.findOne({ product_id: item.product_id }).lean();
                item.product = product;
            }

            // Transformar items → cartItems para el frontend
            order.cartItems = this.transformItemsToCartItems(order.items);
            delete order.items; // Eliminar items de la respuesta
        }

        return orders;
    }

    /**
     * Obtiene un pedido por orderId con productos poblados
     */
    static async getOrderById(orderId, populate = true) {
        // ✨ .lean() convierte a objeto plano
        const order = await OrderModel.findOne({ orderId }).lean();

        if (!order || !populate) {
            return order;
        }

        // Poblar productos manualmente
        for (const item of order.items) {
            const product = await ScrapedProduct.findOne({ product_id: item.product_id }).lean();
            item.product = product;
        }

        // Transformar items → cartItems para el frontend
        order.cartItems = this.transformItemsToCartItems(order.items);
        delete order.items; // Eliminar items de la respuesta

        return order;
    }

    /**
     * Actualiza un pedido completo
     */
    static async updateOrder(orderId, updatedData) {
        if (updatedData.cartItems) {
            updatedData.items = this.transformCartItemsToOrderItems(updatedData.cartItems);
            delete updatedData.cartItems;
        }

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            updatedData,
            { new: true, runValidators: true }
        ).lean();

        // Poblar después de actualizar y transformar a cartItems
        if (updated && updated.items) {
            for (const item of updated.items) {
                const product = await ScrapedProduct.findOne({ product_id: item.product_id }).lean();
                item.product = product;
            }

            // Transformar items → cartItems para el frontend
            updated.cartItems = this.transformItemsToCartItems(updated.items);
            delete updated.items;
        }

        return updated;
    }

    /**
     * Elimina lógicamente un pedido
     */
    static async deleteOrder(orderId) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: 'deleted' },
            { new: true }
        ).lean();
    }

    /**
     * Actualiza solo el estado
     */
    static async updateOrderStatus(orderId, newStatus) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: newStatus },
            { new: true, runValidators: true }
        ).lean();
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