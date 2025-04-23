
# Meyfer Backend (Express.js)

Este es el backend del proyecto **Meyfer**, construido con Node.js, Express.js y MongoDB. Su propósito principal es procesar y almacenar datos provenientes de un archivo Excel remoto, organizando los productos en secciones y ofreciendo endpoints para consultarlos.

## 🧰 Tecnologías utilizadas

- Node.js + Express.js
- MongoDB (Mongoose)
- Docker + Docker Compose
- Railway (para despliegue en producción)
- XLSX (para procesar archivos Excel)
- Axios, dotenv, morgan, cors

## 📁 Estructura del proyecto

```
meyfer-backend-expressjs/
├── src/
│   ├── controllers/       # Controladores de las rutas
│   ├── models/            # Esquemas de MongoDB con Mongoose
│   ├── routes/            # Definición de rutas
│   ├── services/          # Lógica de negocio (parseo de Excel, conexión DB)
│   ├── app.js             # App Express
│   └── index.js           # Punto de entrada del servidor
├── docker-compose.yml     # Configuración para entorno local con Docker
├── .env                   # Variables de entorno
├── package.json           # Dependencias y scripts
└── README.md              # Este archivo
```

## ⚙️ Variables de entorno

Crea un archivo `.env` con el siguiente contenido para desarrollo:

```
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://mongo:27017/meyferdb
```

Para producción en Railway, la variable `MONGO_URI` debe apuntar a la base Mongo remota.

## 🚀 Scripts disponibles

```bash
# Iniciar el servidor (modo producción)
npm start

# Iniciar con nodemon en desarrollo (si instalas nodemon global)
nodemon src/index.js
```

## 🐳 Uso con Docker

```bash
# Construir y levantar los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

Incluye los servicios:

- MongoDB (con autenticación y volumen persistente)
- mongo-express para inspeccionar la base de datos vía navegador

Accede a mongo-express en: `http://localhost:8081`

## 🌐 Endpoints principales

- `GET /api/products` – Lista de secciones y productos desde MongoDB.
- `POST /api/products` – Descarga el XLS remoto, lo parsea y actualiza MongoDB.
- `GET /api/config/profit` – Devuelve el margen de ganancia.
- `PUT /api/config/profit` – Actualiza el margen de ganancia.
- `GET /api/config/last-update` – Devuelve la fecha en que se actualizó el catálogo.

## ☁️ Despliegue en Railway

1. Subir el proyecto a un repositorio GitHub.
2. Conectar el repo a Railway y configurar las variables de entorno:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `MONGO_URI=<tu Mongo en Railway o Atlas>`
3. Railway construirá e iniciará el servidor automáticamente.

---

Desarrollado por Alejandro Daniel Nava
[alejannava@gmail.com](mailto:alejannava@gmail.com)
