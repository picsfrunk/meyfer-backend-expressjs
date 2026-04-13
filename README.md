
# Meyfer Backend (Express.js)

Este es el backend del proyecto **Meyfer**, construido con Node.js, Express.js y MongoDB. Centraliza tres responsabilidades principales: parsear y servir el catálogo de productos desde un Excel remoto, orquestar scrapers y monitores de precios externos, y gestionar pedidos con notificaciones por email a admins y clientes.

## 🧰 Tecnologías utilizadas

- Node.js + Express.js
- MongoDB (Mongoose)
- Docker + Docker Compose
- Railway (para despliegue en producción)
- XLSX (para procesar archivos Excel)
- Cloudinary (almacenamiento de imágenes de productos)
- Mailjet (envío de emails transaccionales)
- Axios, dotenv, morgan, cors, express-rate-limit, jsonwebtoken, multer

## 📁 Estructura del proyecto

```
meyfer-backend-expressjs/
├── src/
│   ├── controllers/       # Controladores de las rutas
│   ├── models/            # Esquemas de MongoDB con Mongoose
│   ├── routes/            # Definición de rutas
│   ├── services/          # Lógica de negocio
│   ├── middlewares/       # Auth, upload, etc.
│   ├── utils/             # Helpers y constantes
│   └── app.js             # App Express
├── index.js               # Punto de entrada del servidor
├── docker-compose.yml     # Configuración para entorno local con Docker
├── .env                   # Variables de entorno (no commitear)
├── Endpoints.md           # Documentación de endpoints
├── package.json           # Dependencias y scripts
└── README.md              # Este archivo
```

## ⚙️ Variables de entorno

Crea un archivo `.env` con el siguiente contenido para desarrollo local:

```env
# Entorno
NODE_ENV=development
PORT=3000

# Base de datos
MONGODB_URI_DEV=mongodb://localhost:27018/meyfer-catalog
MONGODB_URI_PROD=mongodb+srv://<usuario>:<password>@<cluster>.mongodb.net
DB_NAME=meyfer-catalog

# Autenticación admin
ADMIN_USER=admin
ADMIN_PASS=admin
JWT_SECRET=cambia_este_secreto
# JWT_EXPIRES_IN=1h   # opcional, default: 1h

# Cloudinary (gestión de imágenes de productos)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Mailjet (emails transaccionales)
MJ_APIKEY_PUBLIC=
MJ_APIKEY_PRIVATE=
MJ_SENDER_EMAIL=noreply@tudominio.com
MJ_SENDER_NAME=MeyFer

# Scrapers externos (URLs de los microservicios)
CATEGORY_SCRAPER_URL=http://localhost:3001/api/scraper/category
SITEMAP_SCRAPER_URL=http://localhost:3001/api/scraper/sitemap
SITEMAP_ANALYSIS_URL=http://localhost:3001/api/scraper/analyze
PRICE_CHECK_URL=http://localhost:3001/api/scraper/check-prices
SCRAPER_STATUS_URL=http://localhost:3001/api/scraper/status

# Webhooks (URL base del backend para que los scrapers devuelvan resultados)
WEBHOOK_URL=http://localhost:3000/api/webhook/scraper/result
WEBHOOK_PRICE_CHECK_URL=http://localhost:3000/api/webhook/price-check/result
```

> **Nota:** `MONGODB_URI_DEV` se usa cuando `NODE_ENV=development`; `MONGODB_URI_PROD` cuando `NODE_ENV=production`. El README anterior mencionaba `MONGO_URI`, que ya **no existe** en el código.

## 🚀 Scripts disponibles

```bash
# Iniciar el servidor en modo producción
npm start

# Iniciar con nodemon en modo desarrollo
npm run dev
```

## 🐳 Uso con Docker (desarrollo local)

```bash
# Levantar MongoDB local (puerto 27018) y mongo-express (puerto 8081)
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

Accede a **mongo-express** en: `http://localhost:8081`

## ☁️ Despliegue en Railway

1. Subir el proyecto a un repositorio GitHub.
2. Conectar el repo a Railway y configurar las variables de entorno listadas arriba.
3. Establecer `NODE_ENV=production` y `MONGODB_URI_PROD=<tu Mongo en Railway o Atlas>`.
4. Railway construirá e iniciará el servidor automáticamente.

## 📖 Documentación de Endpoints

Ver [`Endpoints.md`](./Endpoints.md) para la documentación completa de todos los endpoints, incluyendo payloads, respuestas y códigos de error.

También se incluye la colección de Postman `MeyFer.postman_collection.json` lista para importar.

---

Desarrollado por Alejandro Daniel Nava
[alejannava@gmail.com](mailto:alejannava@gmail.com)
