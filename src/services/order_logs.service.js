const mongoose = require('mongoose');
const Order = require('../models/order.model');
const OrderLog = require('../models/order_log.model');

class OrderLogsService {
    static normalizeMessage(message) {
        return message == null ? '' : String(message).trim();
    }

    static validateMessage(message) {
        const normalizedMessage = this.normalizeMessage(message);

        if (!normalizedMessage) {
            const error = new Error('message es obligatorio');
            error.statusCode = 400;
            throw error;
        }

        return normalizedMessage;
    }

    static async ensureOrderExists(orderId) {
        const order = await Order.findOne({ orderId }).select({ _id: 1 }).lean();

        if (!order) {
            const error = new Error('Pedido no encontrado');
            error.statusCode = 404;
            throw error;
        }
    }

    static isValidObjectId(id) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    static async getLogsByOrderId(orderId) {
        await this.ensureOrderExists(orderId);

        return OrderLog
            .find({ orderId, isDeleted: false })
            .sort({ createdAt: -1 })
            .lean();
    }

    static async createLog(orderId, logData = {}) {
        await this.ensureOrderExists(orderId);

        const message = this.validateMessage(logData.message);

        return OrderLog.create({
            orderId,
            message,
            type: logData.type || 'note',
            createdBy: logData.createdBy || 'admin'
        });
    }

    static async updateLog(orderId, logId, logData = {}) {
        if (!this.isValidObjectId(logId)) {
            return null;
        }

        const message = this.validateMessage(logData.message);
        const update = {
            message,
            updatedAt: new Date()
        };

        if (logData.type !== undefined) {
            update.type = logData.type || 'note';
        }

        if (logData.updatedBy !== undefined) {
            update.updatedBy = logData.updatedBy;
        }

        return OrderLog.findOneAndUpdate(
            { _id: logId, orderId, isDeleted: false },
            { $set: update },
            { new: true, runValidators: true }
        ).lean();
    }

    static async deleteLog(orderId, logId) {
        if (!this.isValidObjectId(logId)) {
            return null;
        }

        const now = new Date();

        return OrderLog.findOneAndUpdate(
            { _id: logId, orderId, isDeleted: false },
            {
                $set: {
                    isDeleted: true,
                    deletedAt: now,
                    updatedAt: now
                }
            },
            { new: true, runValidators: true }
        ).lean();
    }
}

module.exports = OrderLogsService;
