function notifyClients(event, payload) {
    const { source, status, processed, timestamp } = payload;

    console.log(`\n📣 Notificación recibida: ${event.toUpperCase()}`);
    console.log(`Fuente: ${source}`);
    console.log(`Estado: ${status}`);
    console.log(`Cantidad procesada: ${processed}`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('-----------------------------------');
}

module.exports = {
    notifyClients,
};
