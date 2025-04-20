const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToDb } = require('./database/mongo');
const productRoutes = require('./routes/products.route');
const configRoutes = require('./routes/config.route');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));


app.use('/api/products', productRoutes);
app.use('/api/config', configRoutes);


connectToDb()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

module.exports = app;