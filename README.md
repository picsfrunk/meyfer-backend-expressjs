# MeyFer Backend (Express.js)

![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-4.21-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-8-47A248?logo=mongodb&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-8.13-880000?logo=mongoose&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?logo=jsonwebtokens&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

API REST central del ecosistema **MeyFer**, una plataforma B2B de e-commerce para distribución de productos de ferretería. Este backend orquesta todos los servicios de la plataforma: gestión de catálogo, pedidos, clientes, scraping, notificaciones y configuración del negocio.

Forma parte de un ecosistema de 4 microservicios junto con `meyfer-app-angular` (tienda), `meyfer-admin-react` (panel admin) y `meyfer-scraper` (extracción de datos).

---

## 🛠️ Stack Tecnológico

| Categoría | Tecnología |
|---|---|
| **Runtime / Framework** | Node.js 20 + Express.js 4.21 |
| **Base de Datos** | MongoDB (Mongoose 8.13) |
| **Autenticación** | JWT (jsonwebtoken) con roles admin |
| **Seguridad Webhooks** | SHA-256 + `crypto.timingSafeEqual` |
| **Rate Limiting** | express-rate-limit (5 req/s) |
| **Imágenes** | Cloudinary SDK (WebP, max 800px, upload en memoria) |
| **Emails** | Mailjet v3.1 (node-mailjet) |
| **Upload de archivos** | Multer (memoryStorage, sin disco) |
| **HTTP Client** | Axios (comunicación con microservicio scraper) |
| **Containerización** | Docker + Docker Compose |
| **Deploy** | Railway |

---

## ✨ Funcionalidades Principales

### 🔐 Autenticación y Seguridad
- Autenticación admin mediante JWT Bearer Token con expiración configurable.
- Middleware de autorización que valida firma y rol `admin` en rutas protegidas.
- Webhooks protegidos con secreto compartido validado mediante hash SHA-256 y comparación timing-safe.
- Rate limiting configurable por IP en endpoints públicos de búsqueda.
- CORS con lista blanca dinámica configurable por variable de entorno.

### 📦 Gestión de Pedidos
- Creación pública de pedidos validando `customerCode` del cliente (sin login requerido).
- Snapshot inmutable de datos del cliente al momento de confirmar el pedido.
- Workflow de estados: `pending` → `confirmed` → `processing` → `shipped` → `delivered` (+ `cancelled` / `deleted`).
- Edición de ítems, cantidades y recargo extra con recálculo automático de totales.
- Bitácora interna automática (audit trail) que registra cada cambio de estado, precio, entrega y nota.
- Soft delete con trazabilidad.
- Reenvío selectivo de emails de confirmación (admin, cliente o ambos).

### 👥 Gestión de Clientes
- CRUD completo con datos fiscales (Razón Social, CUIT), contacto y dirección postal.
- Generación automática de código de cliente único (6 caracteres alfanuméricos).
- Regeneración de código preservando unicidad.
- Email de bienvenida al cliente con su código y enlace a la tienda.
- Aviso automático a administradores ante alta de nuevos clientes.

### 🏷️ Catálogo de Productos
- Búsqueda paginada con filtro por texto (full-text search), categoría y marca.
- CRUD administrativo de productos manuales con subida de imagen a Cloudinary.
- Recálculo automático de `final_price` al modificar precio o margen de ganancia.
- Diferenciación entre productos scrapeados (`isManual: false`) y manuales (`isManual: true`).
- Eliminación de imagen en Cloudinary al borrar productos manuales.

### 💰 Configuración de Negocio
- Margen de ganancia global configurable con recálculo masivo (`bulkWrite`) sobre todo el catálogo.
- Gestión de emails de notificación con roles (`admin` / `seller`) y estado activo/inactivo.
- Timestamp de última actualización del catálogo.

### 🕷️ Orquestación del Scraper
- Disparo de scraping por categorías o por sitemap desde endpoints admin.
- Soporte de modo test limitado (`testMode`, `limitProducts`, `limitCategories`, `skipImages`).
- Análisis de sitemap del proveedor.
- Verificación de precios contra el proveedor upstream (price check).
- Monitor de cola en tiempo real con caché in-memory de 30 segundos.
- Historial paginado de jobs con filtros por estado y tipo.
- Cancelación individual o masiva de jobs pendientes.
- Mantenimiento de categorías: restauración oficial y reorganización con soporte `dryRun`.

### 📥 Importación de Listas de Precios
- Configuración de URL remota para descarga automática de lista de precios.
- Upload manual de archivos CSV/XLSX (hasta 20MB) con almacenamiento temporal en memoria.
- Coordinación con microservicio scraper para procesamiento asíncrono.
- Notificación por email con resumen de importación (productos actualizados, sin cambios, errores).

### 📧 Sistema de Notificaciones por Email
- Plantillas HTML para: nuevo pedido, confirmación al cliente, bienvenida, nuevo cliente, fin de scraping, reporte de price check, resultado de importación de listas.
- Envío no bloqueante (`Promise.allSettled`) para no afectar operaciones principales.
- Múltiples destinatarios configurables por rol.

---

## 📋 Requisitos Previos

- Node.js 18 o superior
- MongoDB (local o Atlas)
- Cuentas de API: Cloudinary, Mailjet (opcionales para desarrollo básico)

---

## 🚀 Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Modo desarrollo (nodemon + hot reload)
npm run dev

# Modo producción
npm start

# Tests (Node.js test runner nativo)
npm test
```

La API estará disponible en `http://localhost:3000`.

### 🐳 Docker (MongoDB local)

```bash
# Levantar MongoDB (puerto 27018) y Mongo Express (puerto 8081)
docker-compose up -d

# Detener
docker-compose down
```

Mongo Express disponible en: `http://localhost:8081`

---

## ⚙️ Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

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

# CORS (separar orígenes por coma)
# CORS_ORIGIN=http://localhost:4200,http://localhost:5271

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Mailjet
MJ_APIKEY_PUBLIC=
MJ_APIKEY_PRIVATE=
MAIL_FROM=noreply@tudominio.com
MAIL_FROM_NAME=MeyFer
STORE_PUBLIC_URL=https://tienda.tudominio.com
# SEND_CLIENT_WELCOME_EMAIL=true

# Scraper (microservicio)
SCRAPER_URL=http://localhost:3001/api/scraper
SCRAPER_WEBHOOK_SECRET=secreto_compartido

# Webhooks (URLs que el backend envía al scraper para recibir resultados)
WEBHOOK_URL=http://localhost:3000/api/webhook/scraper/result
WEBHOOK_PRICE_CHECK_URL=http://localhost:3000/api/webhook/price-check/result
WEBHOOK_PRICE_LIST_IMPORT_URL=http://localhost:3000/api/webhook/price-list-import/result
```

> **Nota:** `MONGODB_URI_DEV` se usa cuando `NODE_ENV=development`; `MONGODB_URI_PROD` cuando `NODE_ENV=production`.

---

## 🏗️ Estructura del Proyecto

```text
meyfer-backend-expressjs/
├── index.js                          # Entry point del servidor
├── Dockerfile                        # Imagen Docker (node:20-alpine)
├── docker-compose.yml                # MongoDB local + Mongo Express
├── Endpoints.md                      # Documentación completa de endpoints
├── AGENTS.md                         # Guía técnica para agentes IA
├── MeyFer.postman_collection.json    # Colección Postman importable
├── docs/
│   └── scraper-category-maintenance.md
├── test/
│   ├── customers.service.test.js
│   ├── priceListImport.service.test.js
│   └── webhookAuth.middleware.test.js
└── src/
    ├── app.js                        # Config Express, CORS, rutas, MongoDB
    ├── database/
    │   └── mongo.js                  # Conexión Mongoose según NODE_ENV
    ├── middlewares/
    │   ├── auth.middleware.js         # Validación JWT admin
    │   ├── webhookAuth.middleware.js  # Validación SHA-256 de webhook secret
    │   ├── limiter.middleware.js      # Rate limit (5 req/s)
    │   └── upload.middleware.js       # Multer memoryStorage (5MB img)
    ├── models/                       # 12 esquemas Mongoose
    │   ├── customer.model.js         # Clientes con customerCode único
    │   ├── order.model.js            # Pedidos con snapshot de cliente
    │   ├── order_log.model.js        # Bitácora interna (audit trail)
    │   ├── products.model.js         # Catálogo (text index en nombre/marca)
    │   ├── scraper_job.model.js      # Historial de jobs del scraper
    │   ├── config.model.js           # Configuración dinámica (margen, etc.)
    │   └── ...                       # Admin emails, counters, sections, etc.
    ├── controllers/                  # 11 controladores
    ├── routes/                       # 13 archivos de rutas
    ├── services/                     # 15 servicios de lógica de negocio
    └── utils/                        # Plantillas HTML de emails, helpers
```

---

## 🗺️ Resumen de Endpoints (~50+ rutas)

| Prefijo | Protección | Descripción |
|---|---|---|
| `POST /api/auth/login` | Público | Login admin → JWT token |
| `GET /api/products/*` | Público (rate limited) | Catálogo, búsqueda, marcas |
| `GET /api/categories` | Público | Categorías con conteo de productos |
| `/api/orders/*` | Público (new) / Admin (gestión) | Creación y gestión de pedidos |
| `/api/orders/:id/logs` | Heredado | Bitácora interna de pedidos |
| `/api/admin/products/*` | 🔐 JWT Admin | CRUD de productos con imagen |
| `/api/admin/customers/*` | 🔐 JWT Admin | CRUD de clientes |
| `/api/admin/scraper/*` | 🔐 JWT Admin | Orquestación y monitor del scraper |
| `/api/admin/price-check/*` | 🔐 JWT Admin | Reportes de verificación de precios |
| `/api/admin/price-list-import/*` | 🔐 JWT Admin | Importación de listas de precios |
| `/api/config/*` | 🔐 JWT Admin | Margen, emails, triggers |
| `/api/webhook/*` | 🔑 Webhook Secret | Recepción de resultados del scraper |
| `/api/dev/*` | 🔐 JWT Admin | Herramientas de diagnóstico |

📖 Documentación detallada de payloads y respuestas en [`Endpoints.md`](./Endpoints.md)

📬 Colección Postman lista para importar: `MeyFer.postman_collection.json`

---

## ☁️ Despliegue

El proyecto está configurado para despliegue automático en **Railway**:

1. Conectar el repositorio GitHub a Railway.
2. Configurar las variables de entorno listadas arriba.
3. Establecer `NODE_ENV=production` y la URI de MongoDB Atlas/Railway.
4. Railway construirá e iniciará el servidor automáticamente.

---

## 📄 Licencia

ISC

---

Desarrollado por Alejandro Daniel Nava
[alejannava@gmail.com](mailto:alejannava@gmail.com)
