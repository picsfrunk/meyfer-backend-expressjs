const authRoutes          = require("./auth.routes");
const productRoutes       = require("./products.routes");
const configRoutes        = require("./config.routes");
const webhookRoutes       = require("./webhooks.routes");
const categoryRoutes      = require("./category.routes");
const ordersRoutes        = require("./orders.routes");
const devRoutes           = require("./dev.routes");
const adminScraperRoutes  = require("./admin_scraper.routes");
const adminPriceCheckRoutes = require("./admin_price_check.routes");
const adminProductsRoutes = require("./admin_products.routes");
const adminCustomersRoutes = require("./admin_customers.routes");
const { authenticateAdmin } = require("../middlewares/auth.middleware");
const { Router } = require("express/lib/express");

const router = Router();

router.use('/auth',             authRoutes);
router.use('/products',         productRoutes);
router.use('/config',           authenticateAdmin, configRoutes);
router.use('/webhook',          webhookRoutes);
router.use('/categories',       categoryRoutes);
router.use('/orders',           ordersRoutes);
router.use('/dev',              authenticateAdmin, devRoutes);
router.use('/admin/scraper',    authenticateAdmin, adminScraperRoutes);
router.use('/admin/price-check',authenticateAdmin, adminPriceCheckRoutes);
router.use('/admin/products',   authenticateAdmin, adminProductsRoutes);
router.use('/admin/customers',  authenticateAdmin, adminCustomersRoutes);

module.exports = router;
