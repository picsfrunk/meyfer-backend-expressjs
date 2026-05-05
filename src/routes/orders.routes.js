const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/orders.controller');
const OrderLogsController = require('../controllers/order_logs.controller');

// Crear nuevo pedido
router.post('/new', OrdersController.createOrder);

// Obtener todos los pedidos (con filtro opcional por status)
router.get('/', OrdersController.getAllOrders);

// Obtener estados posibles de pedidos
router.get('/statuses', OrdersController.getOrderStatuses);

// Actualizar solo delivery
router.patch('/:id/delivery', OrdersController.updateOrderDelivery);

// Actualizar solo el estado
router.patch('/:id/status', OrdersController.updateOrderStatus);

// Actualizar precios/cantidades y recargo del pedido
router.patch('/:id/pricing', OrdersController.updateOrderPricing);

// Bitácora interna del pedido
router.get('/:orderId/logs', OrderLogsController.getLogsByOrderId);
router.post('/:orderId/logs', OrderLogsController.createLog);
router.patch('/:orderId/logs/:logId', OrderLogsController.updateLog);
router.delete('/:orderId/logs/:logId', OrderLogsController.deleteLog);

// Obtener pedido por ID
router.get('/:id', OrdersController.getOrderById);

// Actualizar pedido completo
router.put('/:id', OrdersController.updateOrder);

// Eliminar pedido (soft delete)
router.delete('/:id', OrdersController.deleteOrder);

// Reenviar emails
router.post('/:orderId/resend-emails', OrdersController.resendOrderEmails);

module.exports = router;
