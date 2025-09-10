const authRoutes = require("./auth.routes");
const productRoutes = require("./products.routes");
const configRoutes = require("./config.routes");
const webhookRoutes = require("./webhooks.routes");
const categoryRoutes = require("./category.routes");
const ordersRoutes = require("./orders.routes");
const devRoutes = require("./dev.routes");
const { authenticateAdmin } = require("../middlewares/auth.middleware");
const { Router } = require("express/lib/express");

const router = Router();

router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/config', authenticateAdmin, configRoutes);
router.use('/webhook', webhookRoutes);
router.use('/categories', categoryRoutes);
router.use('/orders', ordersRoutes);
router.use('/dev', authenticateAdmin, devRoutes);

module.exports = router;