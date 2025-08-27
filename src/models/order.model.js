const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    customerInfo: { type: Object, required: true },
    cartItems: { type: Array, required: true },
    total: { type: Number, required: true },
    totalItems: { type: Number, required: true },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);
