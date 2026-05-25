const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { connectToMongo } = require('./database/mongo');
const app = express();
const apiRoutes = require('./routes/api.routes');

const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['*'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`[CORS] Origen no permitido: ${origin}`);
        return callback(new Error('CORS: origen no permitido'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
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