const OrderModel = require('../models/order.model');
const Counter = require('../models/counter.model');
const moment = require('moment');

async function getNextOrderNumber() {
    const counter = await Counter.findByIdAndUpdate(
        { _id: 'orderId' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return counter.seq;
}

/**
 * Genera el orderId completo:
 * <numero autoincremental>-<3 primeras letras cliente>-<YYYYMMDD>
 */
async function generateOrderId(customerName) {
    const nextNumber = await getNextOrderNumber();

    // Tomar las 3 primeras letras del cliente, mayúsculas y sin espacios
    const namePart = (customerName || 'XXX').trim().substring(0, 3).toUpperCase();

    // Fecha actual en formato YYYYMMDD
    const datePart = moment().format('YYYYMMDD');

    return `${nextNumber}-${namePart}-${datePart}`;
}

module.exports = { generateOrderId };
