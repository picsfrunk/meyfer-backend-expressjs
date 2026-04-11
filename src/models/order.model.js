const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    product_id: {
        type: String,
        ref: 'ScrapedProduct',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    priceAtPurchase: {
        type: Number,
        required: true
    }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        index: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        index: true,
        default: null
    },
    customerInfo: {
        type: Object,
        required: true
    },
    items: {
        type: [OrderItemSchema],
        required: true,
        validate: {
            validator: (items) => items.length > 0,
            message: 'El pedido debe tener al menos un producto'
        }
    },
    total: {
        type: Number,
        required: true
    },
    extraCharge: {
        type: Number,
        default: 0,
        min: 0
    },
    totalItems: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'deleted']
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
});

OrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
