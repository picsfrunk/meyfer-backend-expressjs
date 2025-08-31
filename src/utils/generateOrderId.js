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
 * <numero autoincremental>-<3 primeras letras cliente>-<YYYYMMDD>-<HHmm>
 */
async function generateOrderId(customerName = "XXX") {
    const nextNumber = await getNextOrderNumber();

    const cleanName = customerName
        .trim()
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase();

    const namePart = (cleanName.substring(0, 3) || "XXX").padEnd(3, "X");

    const datePart = moment().format("YYYYMMDD");
    const timePart = moment().format("HHmm"); // sin ":" queda más uniforme para IDs

    const numberPart = String(nextNumber).padStart(5, "0");

    return `${numberPart}-${namePart}-${datePart}-${timePart}`;
}

module.exports = { generateOrderId };
