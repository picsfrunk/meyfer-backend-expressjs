const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/orders.controller');

// Crear nuevo pedido
router.post('/new', OrdersController.createOrder);

// Obtener todos los pedidos (con filtro opcional por status)
router.get('/', OrdersController.getAllOrders);

// Obtener pedido por ID
router.get('/:id', OrdersController.getOrderById);

// Obtener pedido con detalles completos
router.get('/:id/details', OrdersController.getOrderWithDetails);

// Actualizar pedido completo
router.put('/:id', OrdersController.updateOrder);

// Actualizar solo el estado
router.patch('/:id/status', OrdersController.updateOrderStatus);

// Eliminar pedido (soft delete)
router.delete('/:id', OrdersController.deleteOrder);

// Reenviar emails
router.post('/:orderId/resend-emails', OrdersController.resendOrderEmails);

module.exports = router;