const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToMongo } = require('./database/mongo');
const app = express();
const apiRoutes = require('./routes/api.routes');

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

app.use("/api", apiRoutes);

connectToMongo()
  .then(() => {
    console.log('🟢 Conectado a MongoDB');
  })
  .catch((err) => {
    console.error('🔴 Error al conectar a MongoDB', err);
    process.exit(1); 
  });

module.exports = app;