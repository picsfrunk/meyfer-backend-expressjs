const express = require('express');
const cors = require('cors');
const productRoutes = require('./routes/products.route');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/products', productRoutes);

module.exports = app;