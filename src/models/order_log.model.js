const mongoose = require('mongoose');

const OrderLogSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: 'note'
    },
    createdBy: {
        type: String,
        default: 'admin'
    },
    updatedBy: {
        type: String
    },
    isDeleted: {
        type: Boolean,
        default: false,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date
    },
    deletedAt: {
        type: Date
    }
});

OrderLogSchema.index({ orderId: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('OrderLog', OrderLogSchema);
