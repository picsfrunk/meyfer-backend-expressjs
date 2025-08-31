// src/routes/dev.route.js
const express = require('express');
const router = express.Router();
const { sendOrderNotificationToAdmin } = require('../services/email.service');

router.post('/test-email', async (req, res) => {
    try {
        const order = {
            order_id: 'TEST-EMAIL-000',
            total: 1234.56,
            totalItems: 2,
            customerInfo: { cliente: 'Tester', email: 'test@example.com', telefono1: '...' },
            cartItems: [
                { productCartItem: { product_id: 1, name: 'Prod A', list_price: 1000 }, qty: 1 },
                { productCartItem: { product_id: 2, name: 'Prod B', list_price: 234.56 }, qty: 1 }
            ]
        };

        const info = await sendOrderNotificationToAdmin(order);
        return res.json({ ok: true, messageId: info.messageId });
    } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
