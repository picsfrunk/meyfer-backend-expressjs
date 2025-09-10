const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToMongo } = require('./database/mongo');
const productRoutes = require('./routes/products.routes');
const configRoutes = require('./routes/config.routes');
const webhookRoutes = require("./routes/webhooks.routes");
const categoryRoutes = require("./routes/category.routes")
const ordersRoutes = require("./routes/orders.routes")
const devRoutes = require('./routes/dev.routes');
const authRoutes = require('./routes/auth.routes');
const { authenticateAdmin } = require('./middlewares/auth.middleware');

const app = express();

const allowedOrigin =
    process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN
        : '*';

app.use(cors({
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/config', authenticateAdmin, configRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/dev', authenticateAdmin, devRoutes);


connectToMongo()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

module.exports = app;