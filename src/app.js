const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToMongo } = require('./database/mongo');
const productRoutes = require('./routes/products.route');
const configRoutes = require('./routes/config.route');
const webhookRoutes = require("./routes/webhook.route");
const categoryRoutes = require("./routes/category.route")
const ordersRoutes = require("./routes/orders.route")
const devRoutes = require('./routes/dev.route');


const { verifyTransporter } = require('./services/email.service');

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


app.use('/api/products', productRoutes);
app.use('/api/config', configRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/dev', devRoutes);


connectToMongo()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

verifyTransporter();

module.exports = app;