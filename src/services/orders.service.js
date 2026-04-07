const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const ScrapedProduct = require('../models/products.model');
const {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {
    static sanitizeObjectForMongoOperators(value, path = '') {
        if (Array.isArray(value)) {
            return value.map((item, index) => this.sanitizeObjectForMongoOperators(item, `${path}[${index}]`));
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const sanitized = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            if (key.startsWith('$') || key.includes('.')) {
                const error = new Error(`Campo inválido en actualización: ${path ? `${path}.` : ''}${key}`);
                error.statusCode = 400;
                throw error;
            }
            sanitized[key] = this.sanitizeObjectForMongoOperators(nestedValue, path ? `${path}.${key}` : key);
        }

        return sanitized;
    }

    /**
     * Devuelve los estados válidos definidos en el schema de Order
     */
    static getOrderStatuses() {
        const statusPath = OrderModel.schema.path('status');
        const statuses = statusPath?.enumValues || [];

        return {
            statuses,
            defaultStatus: statusPath?.defaultValue || null
        };
    }

    /**
     * Transforma cartItems (del FE) en items normalizados
     */
    static transformCartItemsToOrderItems(cartItems) {
        if (!Array.isArray(cartItems)) {
            const error = new Error('cartItems debe ser un array');
            error.statusCode = 400;
            throw error;
        }

        if (cartItems.length === 0) {
            const error = new Error('El pedido debe tener al menos un producto');
            error.statusCode = 400;
            throw error;
        }

        return cartItems.map(item => {
            const product = item.productCartItem || item;
            const quantity = Number(item.qty ?? item.quantity ?? 1);
            const priceAtPurchase = Number(
                item.priceAtPurchase ??
                item.unitPrice ??
                product.priceAtPurchase ??
                product.final_price ??
                product.list_price ??
                product.precio ??
                0
            );

            if (!product.product_id) {
                const error = new Error('Cada item debe incluir product_id');
                error.statusCode = 400;
                throw error;
            }

            if (!Number.isInteger(quantity) || quantity < 1) {
                const error = new Error('La cantidad de cada item debe ser un entero mayor o igual a 1');
                error.statusCode = 400;
                throw error;
            }

            if (!Number.isFinite(priceAtPurchase) || priceAtPurchase < 0) {
                const error = new Error('El precio por item debe ser un número mayor o igual a 0');
                error.statusCode = 400;
                throw error;
            }

            return {
                product_id: String(product.product_id),
                quantity,
                priceAtPurchase
            };
        });
    }

    static calculateOrderTotals(items, extraCharge = 0) {
        const normalizedExtraCharge = Number(extraCharge ?? 0);

        if (!Number.isFinite(normalizedExtraCharge) || normalizedExtraCharge < 0) {
            const error = new Error('El recargo extra debe ser un número mayor o igual a 0');
            error.statusCode = 400;
            throw error;
        }

        const productsTotal = items.reduce((acc, item) => acc + (item.quantity * item.priceAtPurchase), 0);
        const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
        const total = Number((productsTotal + normalizedExtraCharge).toFixed(2));

        return {
            total,
            totalItems,
            extraCharge: normalizedExtraCharge
        };
    }

    /**
     * Transforma items normalizados (de DB) al formato que espera el frontend
     * Convierte: { product_id, quantity, priceAtPurchase, product: {...} }
     * A: { qty, productCartItem: {...} }
     */
    static transformItemsToCartItems(items) {
        return items.map(item => ({
            qty: item.quantity,
            priceAtPurchase: item.priceAtPurchase,
            productCartItem: item.product || {}
        }));
    }

    /**
     * Crea un nuevo pedido (normalizado)
     */
    static async handleNewOrder(orderData) {
        const normalizedItems = this.transformCartItemsToOrderItems(orderData.cartItems);
        const totals = this.calculateOrderTotals(normalizedItems, orderData.extraCharge);

        const orderDoc = await OrderModel.create({
            customerInfo: orderData.customerInfo,
            items: normalizedItems,
            total: totals.total,
            totalItems: totals.totalItems,
            extraCharge: totals.extraCharge,
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
        const updatePayload = { ...updatedData };
        const currentOrder = await OrderModel.findOne({ orderId }).lean();

        if (!currentOrder) {
            return null;
        }

        if (updatePayload.customerInfo && currentOrder.customerInfo) {
            updatePayload.customerInfo = {
                ...currentOrder.customerInfo,
                ...updatePayload.customerInfo,
                direccion: {
                    ...(currentOrder.customerInfo.direccion || {}),
                    ...(updatePayload.customerInfo.direccion || {})
                }
            };
        }

        if (updatePayload.cartItems) {
            updatePayload.items = this.transformCartItemsToOrderItems(updatePayload.cartItems);
            delete updatePayload.cartItems;
        } else if (updatePayload.items) {
            updatePayload.items = this.transformCartItemsToOrderItems(updatePayload.items);
        }

        const shouldRecalculateTotals =
            Array.isArray(updatePayload.items) ||
            Object.prototype.hasOwnProperty.call(updatePayload, 'extraCharge');

        if (shouldRecalculateTotals) {
            const items = updatePayload.items || currentOrder.items;
            const extraCharge = Object.prototype.hasOwnProperty.call(updatePayload, 'extraCharge')
                ? updatePayload.extraCharge
                : currentOrder.extraCharge;
            const totals = this.calculateOrderTotals(items, extraCharge);

            updatePayload.total = totals.total;
            updatePayload.totalItems = totals.totalItems;
            updatePayload.extraCharge = totals.extraCharge;
        }

        const sanitizedUpdatePayload = this.sanitizeObjectForMongoOperators(updatePayload);

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            sanitizedUpdatePayload,
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

    static async updateOrderPricing(orderId, pricingData = {}) {
        const updatePayload = {};

        if (pricingData.cartItems) {
            updatePayload.cartItems = pricingData.cartItems;
        } else if (pricingData.items) {
            updatePayload.items = pricingData.items;
        } else {
            const error = new Error('Debes enviar items o cartItems para actualizar precios');
            error.statusCode = 400;
            throw error;
        }

        if (Object.prototype.hasOwnProperty.call(pricingData, 'extraCharge')) {
            updatePayload.extraCharge = pricingData.extraCharge;
        }

        return this.updateOrder(orderId, updatePayload);
    }

    /**
     * Elimina lógicamente un pedido
     */
    static async deleteOrder(orderId) {
        return OrderModel.findOneAndUpdate(
            { orderId },
            { status: 'deleted' },
            { new: true, runValidators: true }
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
