const mongoose = require('mongoose');
require('dotenv').config();

async function connectToDb() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.DB_NAME || 'catalog',
    });
    console.log(`MongoDB conectado a la base de datos: ${process.env.DB_NAME || 'catalog'}`);
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error.message);
    process.exit(1);
  }
}

module.exports = { connectToDb };
