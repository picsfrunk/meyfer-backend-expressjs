const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToDb } = require('./database/mongo');
const productRoutes = require('./routes/products.route');
const configRoutes = require('./routes/config.route');
const webhookRoutes = require("./routes/webhook.route");

const app = express();

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

app.use(cors({
    origin: allowedOrigin
}));
app.use(express.json());
app.use(morgan('dev'));


app.use('/api/products', productRoutes);
app.use('/api/config', configRoutes);
app.use('/api/webhook', webhookRoutes);


connectToDb()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

module.exports = app;