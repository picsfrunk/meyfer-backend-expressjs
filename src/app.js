const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToMongo } = require('./database/mongo');
const productRoutes = require('./routes/products.route');
const configRoutes = require('./routes/config.route');
const webhookRoutes = require("./routes/webhook.route");

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


connectToMongo()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

module.exports = app;