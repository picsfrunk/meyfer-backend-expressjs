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

    // Normalizar cliente: quitar espacios, caracteres no alfabéticos y usar mayúsculas
    const cleanName = customerName
        .trim()
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase();

    // Tomar primeras 3 letras o rellenar con "X"
    const namePart = (cleanName.substring(0, 3) || "XXX").padEnd(3, "X");

    // Fecha y hora
    const datePart = moment().format("YYYYMMDD");
    const timePart = moment().format("HHmm"); // sin ":" queda más uniforme para IDs

    // Si querés que el número sea siempre de 5 dígitos (ej: 00001)
    const numberPart = String(nextNumber).padStart(5, "0");

    return `${numberPart}-${namePart}-${datePart}-${timePart}`;
}

module.exports = { generateOrderId };
