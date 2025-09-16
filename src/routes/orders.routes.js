const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/orders.controller');
const {authenticateAdmin} = require("../middlewares/auth.middleware");

// Endpoint para crear un nuevo pedido (CREATE)
router.post('/new', OrdersController.createOrder);

// Endpoint para obtener todos los pedidos (READ all)
router.get('/', authenticateAdmin, OrdersController.getAllOrders);

// Endpoint para obtener un pedido por su ID (READ one)
router.get('/:id', authenticateAdmin, OrdersController.getOrderById);

// Endpoint para modificar un pedido completo por su ID (UPDATE)
router.put('/:id', authenticateAdmin, OrdersController.updateOrder);

// Endpoint para eliminar un pedido por su ID (DELETE)
router.delete('/:id', authenticateAdmin, OrdersController.deleteOrder);

// Endpoint específico para modificar solo el estado de un pedido (UPDATE parcial)
router.patch('/:id/status', authenticateAdmin, OrdersController.updateOrderStatus);

module.exports = router;