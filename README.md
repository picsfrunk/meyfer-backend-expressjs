
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
# Documentación de Endpoints - MeyFer Backend

## Productos (`src/routes/products.route.js`)
- `GET /api/products/parsed`  
  Devuelve los productos parseados desde el Excel remoto.
- `POST /api/products/parsed`  
  Actualiza el catálogo parseando el Excel y guardando en MongoDB.
- `POST /api/products/scrape`  
  Dispara el microservicio de scraping (categoryScraper/sitemapScraper).
- `GET /api/products/scraped`  
  Obtiene productos scrapeados (paginados, filtrados).
- `GET /api/products/scraped/:id`  
  Consulta producto scrapeado por ID.

## Órdenes (`src/routes/orders.route.js`)
- `POST /api/orders`  
  Crea un nuevo pedido.
- `GET /api/orders` *(comentado en el código, posible endpoint)*  
  Lista todos los pedidos.
- `GET /api/orders/:id` *(comentado en el código, posible endpoint)*  
  Detalle de pedido por ID.

## Categorías (`src/routes/category.route.js`)
- `GET /api/categories`  
  Lista todas las categorías con cantidad de productos por cada una.

## Configuración (`controllers/config.controller.js`)
- `GET /api/config/profit`  
  Devuelve el margen de ganancia.
- `PUT /api/config/profit`  
  Actualiza el margen de ganancia.
- `GET /api/config/last-update`  
  Fecha de última actualización del catálogo.

## Otros endpoints relevantes
- `GET /api/products`  
  Lista de secciones y productos desde MongoDB.
- `POST /api/products`  
  Descarga el XLS remoto, lo parsea y actualiza MongoDB.

## Notas
- Todos los endpoints siguen la arquitectura controlador-servicio-helper.
- El endpoint `/api/products/scrape` se comunica con un microservicio externo y centraliza la lógica de scraping y notificaciones vía webhook.
- El endpoint de categorías entrega la cantidad de productos por categoría y el total general.
- Puedes encontrar detalles específicos de cada endpoint en los archivos de rutas y controladores correspondientes.

---

> Si necesitas ejemplos de request/response o detalles de middlewares (como autenticación), revisa los archivos en `src/middlewares/` y la colección Postman incluida en el repo.
## ☁️ Despliegue en Railway

1. Subir el proyecto a un repositorio GitHub.
2. Conectar el repo a Railway y configurar las variables de entorno:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `MONGO_URI=<tu Mongo en Railway o Atlas>`
3. Railway construirá e iniciará el servidor automáticamente.

---


### Commit [`d17c32f`](https://github.com/picsfrunk/meyfer-backend-expressjs/commit/d17c32fa556a603270a686399bfbe7a853e2298c)
**feat: endpoint para disparar scraper de productos**

- Se agregó un endpoint POST `/api/products/scrape` que permite iniciar, desde el backend, el proceso de scraping en el microservicio scraper.
- El endpoint recibe los parámetros necesarios para el tipo de scrapeo (`categoryScraper` o `sitemapScraper`) y los reenvía al microservicio, agregando automáticamente la URL de webhook.
- El backend ahora se encarga de orquestar la comunicación entre el frontend y el scraper, centralizando la lógica y facilitando el manejo de notificaciones a través del webhook.
- Mejoras en la estructura del service y controller para robustecer la comunicación y manejo de errores al disparar el proceso de scraping.

Desarrollado por Alejandro Daniel Nava
[alejannava@gmail.com](mailto:alejannava@gmail.com)
