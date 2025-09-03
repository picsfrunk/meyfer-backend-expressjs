const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.NODE_ENV === 'production'
    ? process.env.MONGODB_URI_PROD
    : process.env.MONGODB_URI_DEV;

async function connectToMongo() {
  try {
    await mongoose.connect(uri, {
      dbName: process.env.DB_NAME || 'meyfer-catalog',
      authSource: "admin"
    });
    console.log(`MongoDB conectado a la base de datos: ${process.env.DB_NAME || 'meyfer-catalog'}`);
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error.message);
  }
}

module.exports = { connectToMongo: connectToMongo };
