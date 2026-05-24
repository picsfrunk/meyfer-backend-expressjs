const mongoose = require('mongoose');

const isProduction = process.env.NODE_ENV === 'production';
const uriEnvName = isProduction ? 'MONGODB_URI_PROD' : 'MONGODB_URI_DEV';
const uri = process.env[uriEnvName];
const dbName = process.env.DB_NAME || 'meyfer-catalog';

async function connectToMongo() {
  if (!uri) {
    throw new Error(`${uriEnvName} no está configurada`);
  }

  try {
    await mongoose.connect(uri, {
      dbName,
      authSource: 'admin'
    });
    console.log(`MongoDB conectado usando ${uriEnvName} a la base de datos: ${dbName}`);
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error.message);
    throw error;
  }
}

module.exports = { connectToMongo };
