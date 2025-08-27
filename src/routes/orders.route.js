const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/orders.controller');

// Endpoint para crear un nuevo pedido
router.post('/', OrdersController.createOrder);

// Otros endpoints podrían ser:
// router.get('/', OrdersController.getAllOrders);
// router.get('/:id', OrdersController.getOrderById);

module.exports = router;
