const { generateOrderId } = require("../utils/generateOrderId");
const OrderModel = require('../models/order.model');
const ScrapedProduct = require('../models/products.model');
const Customer = require('../models/customer.model');
const OrderLogsService = require('./order_logs.service');
const {
    sendOrderNotificationToAdmins,
    sendOrderConfirmationToCustomer
} = require("./email.service");

class OrdersService {

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

            if (product.product_id === undefined || product.product_id === null || String(product.product_id).trim() === '') {
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

        const { productsTotal, totalItems } = items.reduce((acc, item) => {
            acc.productsTotal += item.quantity * item.priceAtPurchase;
            acc.totalItems += item.quantity;
            return acc;
        }, { productsTotal: 0, totalItems: 0 });
        const total = Number((productsTotal + normalizedExtraCharge).toFixed(2));

        return {
            total,
            totalItems,
            extraCharge: normalizedExtraCharge
        };
    }

    static normalizeCustomerNote(value) {
        return value == null ? '' : String(value).trim();
    }

    static resolveCustomerNote(orderData = {}) {
        const noteSources = [
            orderData.customerNote,
            orderData.notes,
            orderData.note,
            orderData.notas,
            orderData.customerInfo?.notas
        ];
        const note = noteSources.find(value => value !== undefined && value !== null);

        return this.normalizeCustomerNote(note);
    }

    static ensureCustomerNote(order) {
        if (order && order.customerNote == null) {
            order.customerNote = '';
        }
        return order;
    }

    static valuesAreEqual(a, b) {
        return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    }

    static formatMoney(value) {
        return Number(value ?? 0);
    }

    static buildOrderItemsMap(items = []) {
        return new Map(items.map(item => [
            String(item.product_id),
            {
                product_id: String(item.product_id),
                quantity: item.quantity,
                priceAtPurchase: item.priceAtPurchase
            }
        ]));
    }

    static buildItemsChangeMetadata(previousItems = [], nextItems = []) {
        const previousMap = this.buildOrderItemsMap(previousItems);
        const nextMap = this.buildOrderItemsMap(nextItems);
        const added = [];
        const removed = [];
        const updated = [];

        for (const [productId, nextItem] of nextMap.entries()) {
            const previousItem = previousMap.get(productId);
            if (!previousItem) {
                added.push(nextItem);
                continue;
            }

            const changes = {};
            if (previousItem.quantity !== nextItem.quantity) {
                changes.quantity = { from: previousItem.quantity, to: nextItem.quantity };
            }
            if (previousItem.priceAtPurchase !== nextItem.priceAtPurchase) {
                changes.priceAtPurchase = {
                    from: previousItem.priceAtPurchase,
                    to: nextItem.priceAtPurchase
                };
            }

            if (Object.keys(changes).length) {
                updated.push({ product_id: productId, changes });
            }
        }

        for (const [productId, previousItem] of previousMap.entries()) {
            if (!nextMap.has(productId)) {
                removed.push(previousItem);
            }
        }

        return { added, removed, updated };
    }

    static hasItemsChanges(itemsChangeMetadata) {
        return Boolean(
            itemsChangeMetadata.added.length ||
            itemsChangeMetadata.removed.length ||
            itemsChangeMetadata.updated.length
        );
    }

    static buildPricingChangeLog(currentOrder, nextOrder) {
        const items = this.buildItemsChangeMetadata(currentOrder.items, nextOrder.items);
        const previousExtraCharge = this.formatMoney(currentOrder.extraCharge);
        const nextExtraCharge = this.formatMoney(nextOrder.extraCharge);
        const extraChargeChanged = previousExtraCharge !== nextExtraCharge;

        if (!this.hasItemsChanges(items) && !extraChargeChanged) {
            return null;
        }

        const summary = [];
        if (items.added.length) summary.push(`${items.added.length} producto(s) agregado(s)`);
        if (items.removed.length) summary.push(`${items.removed.length} producto(s) quitado(s)`);
        if (items.updated.length) summary.push(`${items.updated.length} producto(s) modificado(s)`);
        if (extraChargeChanged) {
            summary.push(`cargo extra de ${previousExtraCharge} a ${nextExtraCharge}`);
        }

        return {
            type: 'pricing_change',
            message: `Cambios de productos/precios: ${summary.join(', ')}`,
            metadata: {
                items,
                extraCharge: extraChargeChanged
                    ? { from: previousExtraCharge, to: nextExtraCharge }
                    : null,
                total: {
                    from: currentOrder.total,
                    to: nextOrder.total
                },
                totalItems: {
                    from: currentOrder.totalItems,
                    to: nextOrder.totalItems
                }
            }
        };
    }

    static async createOrderChangeLog(orderId, type, message, metadata = {}) {
        return OrderLogsService.createLog(orderId, {
            type,
            message,
            metadata,
            createdBy: 'system'
        });
    }

    static async logOrderChanges(currentOrder, nextOrder, changedFields = {}) {
        const logs = [];

        if ('status' in changedFields && currentOrder.status !== nextOrder.status) {
            logs.push(this.createOrderChangeLog(
                nextOrder.orderId,
                'status_change',
                `Estado cambiado de ${currentOrder.status} a ${nextOrder.status}`,
                { from: currentOrder.status, to: nextOrder.status }
            ));
        }

        if ('delivery' in changedFields && !this.valuesAreEqual(currentOrder.delivery, nextOrder.delivery)) {
            logs.push(this.createOrderChangeLog(
                nextOrder.orderId,
                'delivery_change',
                'Datos de entrega actualizados',
                { from: currentOrder.delivery, to: nextOrder.delivery }
            ));
        }

        if ('customerNote' in changedFields && currentOrder.customerNote !== nextOrder.customerNote) {
            logs.push(this.createOrderChangeLog(
                nextOrder.orderId,
                'customer_note_change',
                'Observación del cliente actualizada',
                { from: currentOrder.customerNote || '', to: nextOrder.customerNote || '' }
            ));
        }

        if ('customerInfo' in changedFields && !this.valuesAreEqual(currentOrder.customerInfo, nextOrder.customerInfo)) {
            logs.push(this.createOrderChangeLog(
                nextOrder.orderId,
                'customer_info_change',
                'Datos del cliente en el pedido actualizados',
                { from: currentOrder.customerInfo, to: nextOrder.customerInfo }
            ));
        }

        if ('items' in changedFields || 'extraCharge' in changedFields) {
            const pricingLog = this.buildPricingChangeLog(currentOrder, nextOrder);
            if (pricingLog) {
                logs.push(this.createOrderChangeLog(
                    nextOrder.orderId,
                    pricingLog.type,
                    pricingLog.message,
                    pricingLog.metadata
                ));
            }
        }

        if (logs.length) {
            await Promise.all(logs);
        }
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

        // Validar y buscar cliente por customerCode
        const rawCustomerCode = orderData.customerInfo?.customerCode;
        const customerCode = rawCustomerCode != null ? String(rawCustomerCode).trim().toUpperCase() : '';
        if (!customerCode) {
            const error = new Error('El código de cliente es requerido');
            error.statusCode = 400;
            error.code = 'MISSING_CUSTOMER_CODE';
            throw error;
        }

        const customer = await Customer.findOne({ customerCode });
        if (!customer) {
            const error = new Error('Cliente no encontrado');
            error.statusCode = 404;
            error.code = 'CUSTOMER_NOT_FOUND';
            throw error;
        }

        // Construir snapshot inmutable desde la DB (nunca desde el body)
        const customerInfo = {
            customerCode: customer.customerCode,
            cliente:      customer.cliente,
            razonSocial:  customer.razonSocial,
            cuit:         customer.cuit,
            contacto:     customer.contacto,
            email:        customer.email,
            telefono1:    customer.telefono1
        };


        // Resolver dirección de entrega: payload si tiene datos, sino la del cliente
        const DIRECCION_KEYS = ['calle', 'numero', 'piso', 'timbre', 'entreCalles', 'localidad', 'partido'];

        const payloadDelivery = orderData.delivery || {};
        const payloadAddress = payloadDelivery.address;

        const hasPayloadAddress = payloadAddress &&
            typeof payloadAddress === 'object' &&
            DIRECCION_KEYS.some(k =>
                payloadAddress[k] !== undefined &&
                payloadAddress[k] !== null &&
                String(payloadAddress[k]).trim() !== ''
            );

// fallback a dirección del cliente si no viene address
        const address = hasPayloadAddress
            ? Object.fromEntries(DIRECCION_KEYS.map(k => [k, payloadAddress[k] ?? '']))
            : (customer.direccion || {});

// 👇 NUEVO OBJETO DELIVERY
        const delivery = {
            address,
            contactName: payloadDelivery.contactName || customer.contacto || '',
            contactPhone: payloadDelivery.contactPhone || customer.telefono1 || '',
            schedule: payloadDelivery.schedule || ''
        };
        const customerNote = this.resolveCustomerNote(orderData);

        const orderDoc = await OrderModel.create({
            customerInfo,
            customerNote,
            customerId: customer._id,
            delivery,
            items: normalizedItems,
            total: totals.total,
            totalItems: totals.totalItems,
            extraCharge: totals.extraCharge,
            orderId: await generateOrderId(customer.cliente)
        });

        // Notificaciones asíncronas
        const adminEmailTask = this.getOrderById(orderDoc.orderId, true)
            .then(orderForEmail => sendOrderNotificationToAdmins(orderForEmail || orderDoc));

        Promise.allSettled([
            adminEmailTask,
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
    static async getAllOrders(status, populate = true, customerCode = null) {
        const filter = {};
        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',') };
            } else {
                filter.status = status;
            }
        }
        if (customerCode) {
            filter['customerInfo.customerCode'] = customerCode.trim().toUpperCase();
        }

        // ✨ .lean() convierte documentos Mongoose a objetos JavaScript planos
        const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).lean();

        if (!populate) {
            return orders.map(order => this.ensureCustomerNote(order));
        }

        // Poblar productos manualmente y transformar al formato del frontend
        for (const order of orders) {
            this.ensureCustomerNote(order);

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
            return this.ensureCustomerNote(order);
        }

        this.ensureCustomerNote(order);

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

        if (updatePayload.customerInfo) {
            const currentCustomerInfo = currentOrder.customerInfo || {};
            updatePayload.customerInfo = {
                ...currentCustomerInfo,
                ...updatePayload.customerInfo
            };
        }

        if (updatePayload.delivery) {
            const DIRECCION_KEYS = ['calle', 'numero', 'piso', 'timbre', 'entreCalles', 'localidad', 'partido'];

            const currentDelivery = currentOrder.delivery || {};
            const incoming = updatePayload.delivery;

            const mergedAddress = Object.fromEntries(
                DIRECCION_KEYS.map(k => [
                    k,
                    incoming.address?.[k] !== undefined
                        ? incoming.address[k]
                        : (currentDelivery.address?.[k] ?? '')
                ])
            );

            updatePayload.delivery = {
                address: mergedAddress,
                contactName: incoming.contactName ?? currentDelivery.contactName ?? '',
                contactPhone: incoming.contactPhone ?? currentDelivery.contactPhone ?? '',
                schedule: incoming.schedule ?? currentDelivery.schedule ?? ''
            };
        }

        if ('customerNote' in updatePayload) {
            updatePayload.customerNote = this.normalizeCustomerNote(updatePayload.customerNote);
        }

        if (updatePayload.cartItems) {
            updatePayload.items = this.transformCartItemsToOrderItems(updatePayload.cartItems);
            delete updatePayload.cartItems;
        } else if (updatePayload.items) {
            updatePayload.items = this.transformCartItemsToOrderItems(updatePayload.items);
        }

        const shouldRecalculateTotals =
            Array.isArray(updatePayload.items) ||
            'extraCharge' in updatePayload;

        if (shouldRecalculateTotals) {
            const items = updatePayload.items || currentOrder.items;
            const extraCharge = 'extraCharge' in updatePayload
                ? updatePayload.extraCharge
                : currentOrder.extraCharge;
            const totals = this.calculateOrderTotals(items, extraCharge);

            updatePayload.total = totals.total;
            updatePayload.totalItems = totals.totalItems;
            updatePayload.extraCharge = totals.extraCharge;
        }

        const allowedFields = ['customerInfo', 'customerNote', 'delivery', 'items', 'total', 'totalItems', 'status', 'extraCharge'];
        const updateSet = {};
        for (const field of allowedFields) {
            if (field in updatePayload) {
                updateSet[field] = updatePayload[field];
            }
        }

        if (!Object.keys(updateSet).length) {
            const error = new Error('No hay campos válidos para actualizar');
            error.statusCode = 400;
            throw error;
        }

        const updateDocument = { $set: updateSet };

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            updateDocument,
            { new: true, runValidators: true }
        ).lean();

        if (updated) {
            await this.logOrderChanges(currentOrder, updated, updateSet);
        }

        // Poblar después de actualizar y transformar a cartItems
        if (updated && updated.items) {
            this.ensureCustomerNote(updated);

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

    static async updateOrderDelivery(orderId, delivery = {}) {
        const currentOrder = await OrderModel.findOne({ orderId }).lean();

        if (!currentOrder) {
            return null;
        }

        const DIRECCION_KEYS = ['calle', 'numero', 'piso', 'timbre', 'entreCalles', 'localidad', 'partido'];

        const currentDelivery = currentOrder.delivery || {};
        const incomingAddress = delivery.address;

        const address = incomingAddress
            ? Object.fromEntries(
                DIRECCION_KEYS.map(k => [
                    k,
                    incomingAddress[k] !== undefined
                        ? incomingAddress[k]
                        : (currentDelivery.address?.[k] ?? '')
                ])
            )
            : (currentDelivery.address || {});

        const normalizedDelivery = {
            address,
            contactName: delivery.contactName ?? currentDelivery.contactName ?? '',
            contactPhone: delivery.contactPhone ?? currentDelivery.contactPhone ?? '',
            schedule: delivery.schedule ?? currentDelivery.schedule ?? ''
        };

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            { $set: { delivery: normalizedDelivery } },
            { new: true, runValidators: true }
        ).lean();

        if (updated) {
            await this.logOrderChanges(currentOrder, updated, { delivery: normalizedDelivery });
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

        if ('extraCharge' in pricingData) {
            updatePayload.extraCharge = pricingData.extraCharge;
        }

        return this.updateOrder(orderId, updatePayload);
    }

    /**
     * Elimina lógicamente un pedido
     */
    static async deleteOrder(orderId) {
        const currentOrder = await OrderModel.findOne({ orderId }).lean();

        if (!currentOrder) {
            return null;
        }

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            { status: 'deleted' },
            { new: true, runValidators: true }
        ).lean();

        if (updated && currentOrder.status !== updated.status) {
            await this.createOrderChangeLog(
                orderId,
                'order_deleted',
                `Pedido eliminado: estado cambiado de ${currentOrder.status} a deleted`,
                { from: currentOrder.status, to: updated.status }
            );
        }

        return updated;
    }

    /**
     * Actualiza solo el estado
     */
    static async updateOrderStatus(orderId, newStatus) {
        const currentOrder = await OrderModel.findOne({ orderId }).lean();

        if (!currentOrder) {
            return null;
        }

        const updated = await OrderModel.findOneAndUpdate(
            { orderId },
            { status: newStatus },
            { new: true, runValidators: true }
        ).lean();

        if (updated) {
            await this.logOrderChanges(currentOrder, updated, { status: newStatus });
        }

        return updated;
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
