const express = require('express');
const router = express.Router();
const OrdersController = require('../controllers/orders.controller');
const {authenticateAdmin} = require("../middlewares/auth.middleware");

router.get('/', authenticateAdmin, OrdersController.getAllOrders);
router.post('/new', OrdersController.createOrder);
router.get('/:id', authenticateAdmin, OrdersController.getOrderById);
router.put('/:id', authenticateAdmin, OrdersController.updateOrder);
router.delete('/:id', authenticateAdmin, OrdersController.deleteOrder);
router.patch('/:id/status', authenticateAdmin, OrdersController.updateOrderStatus);
router.post('/:orderId/resend-emails', OrdersController.resendOrderEmails);

module.exports = router;