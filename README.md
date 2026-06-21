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

```text
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
MAIL_FROM=noreply@tudominio.com
MAIL_FROM_NAME=MeyFer
# Compatibilidad temporal: también se aceptan MJ_SENDER_EMAIL y MJ_SENDER_NAME

# Scrapers externos (URLs de los microservicios)
CATEGORY_SCRAPER_URL=http://localhost:3001/api/scraper/category
SITEMAP_SCRAPER_URL=http://localhost:3001/api/scraper/sitemap
SITEMAP_ANALYSIS_URL=http://localhost:3001/api/scraper/analyze
PRICE_CHECK_URL=http://localhost:3001/api/scraper/check-prices
SCRAPER_STATUS_URL=http://localhost:3001/api/scraper/status
SCRAPER_URL=http://localhost:3001/api/scraper
# Opcionales: si no se configuran, se derivan desde SCRAPER_URL
SCRAPER_CATEGORIES_RESTORE_URL=http://localhost:3001/api/scraper/categories/restore-official
SCRAPER_CATEGORIES_REORGANIZE_URL=http://localhost:3001/api/scraper/categories/reorganize

# Webhooks (URL del backend para que los scrapers devuelvan resultados)
WEBHOOK_URL=http://localhost:3000/api/webhook/scraper/result
WEBHOOK_PRICE_CHECK_URL=http://localhost:3000/api/webhook/price-check/result
SCRAPER_WEBHOOK_SECRET=change-me
```

> **Nota:** `MONGODB_URI_DEV` se usa cuando `NODE_ENV=development`; `MONGODB_URI_PROD` cuando `NODE_ENV=production`. El README anterior mencionaba `MONGO_URI`, que ya **no existe** en el código.
>
> **Nota Mailjet:** para el remitente se recomienda usar `MAIL_FROM` y `MAIL_FROM_NAME`. Por compatibilidad temporal, el backend también acepta `MJ_SENDER_EMAIL` y `MJ_SENDER_NAME` como fallback.

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

## 📦 Pedidos

Los pedidos se crean con `POST /api/orders/new` usando un cliente existente referenciado por `customerInfo.customerCode`. El backend arma el snapshot `customerInfo` desde la base de datos y guarda los datos de entrega en `delivery`.

Cada pedido puede incluir una observación libre opcional del cliente en `customerNote`. El valor se normaliza a string con `trim()` y, si no se envía, se guarda como `''`. Para compatibilidad temporal, creación también acepta `notes`, `note`, `notas` o `customerInfo.notas`, pero siempre persiste la observación en `customerNote`.

`customerNote` no pertenece a `customerInfo`, no pertenece a `delivery` y no debe mezclarse con `delivery.schedule`, que sigue representando únicamente el horario o ventana de entrega.

### Bitácora interna de pedidos

Cada pedido puede tener una bitácora interna para seguimiento operativo del equipo/admin. Esta bitácora se guarda en una colección separada (`OrderLog`) y no modifica el documento `Order`.

La bitácora no reemplaza ni se mezcla con `customerNote`: `customerNote` es la observación escrita por el cliente al crear el pedido; los logs son notas internas posteriores para administración.

Además de notas manuales (`type: "note"`), el backend registra automáticamente cambios operativos del pedido con tipos específicos como `status_change`, `delivery_change`, `pricing_change`, `customer_note_change`, `customer_info_change` y `order_deleted`. Estos logs pueden incluir `metadata` con valores anteriores/nuevos, productos agregados/quitados/modificados, cambios de recargo extra y totales.

Endpoints disponibles:

- `GET /api/orders/:orderId/logs`
- `POST /api/orders/:orderId/logs`
- `PATCH /api/orders/:orderId/logs/:logId`
- `DELETE /api/orders/:orderId/logs/:logId`

Los logs eliminados usan soft delete (`isDeleted`, `deletedAt`) y no aparecen en el listado.

## 🔁 Webhooks de scraper

El backend le envía al microservicio scraper la URL de respuesta en el campo `webhookUrl`. El scraper no debería tener hardcodeado el endpoint del backend: debe usar la URL recibida.

### Modo limitado de scraper

El endpoint admin `POST /api/admin/scraper/trigger` acepta parámetros opcionales para disparar corridas limitadas de `categoryScraper` o `sitemapScraper` sin exponer públicamente el microservicio scraper:

```json
{
  "scraperType": "categoryScraper",
  "categoryIds": "all",
  "testMode": true,
  "limitProducts": 10,
  "limitCategories": 1,
  "skipImages": true
}
```

Parámetros validados por el backend antes de reenviar al scraper:

- `testMode`: boolean.
- `skipImages`: boolean.
- `limitProducts`: entero positivo, máximo `100`.
- `limitCategories`: entero positivo, máximo `5`.

`limitProducts` no implica `dryRun`: una corrida limitada puede persistir esos pocos productos si el scraper real persiste. En modo limitado, el scraper omite la limpieza de huérfanos. Este modo sirve para pruebas rápidas y validación de webhooks/cancelación.

Endpoints reales que recibe este backend:

- `POST /api/webhook/scraper/result`
- `POST /api/webhook/price-check/result`

Ambos endpoints públicos requieren el header `X-Webhook-Secret` con el mismo valor configurado en `SCRAPER_WEBHOOK_SECRET`. Esta variable debe existir en backend y scraper, con idéntico valor en ambos servicios. No debe commitearse en el repositorio. En Railway hay que agregarla como variable de entorno en backend y scraper; después de cambiarla, redeployar ambos servicios.

Variables críticas en producción:

```env
WEBHOOK_URL=https://<backend-production-url>/api/webhook/scraper/result
WEBHOOK_PRICE_CHECK_URL=https://<backend-production-url>/api/webhook/price-check/result
SCRAPER_WEBHOOK_SECRET=<mismo-secreto-configurado-en-el-scraper>
```

Checklist rápido si el historial del scraper no se actualiza:

1. Verificar que `WEBHOOK_URL` no apunte a `/webhooks/...`; el path real es `/api/webhook/...`.
2. Verificar que el microservicio scraper esté recibiendo y usando el `webhookUrl` enviado por el backend.
3. Verificar que MongoDB esté conectado y que los eventos creen/actualicen documentos `ScraperJob`.
4. Probar manualmente `POST /api/webhook/scraper/result` con un payload `completed` de prueba y luego consultar `/api/admin/scraper/history`.

## 🧩 Mantenimiento seguro de categorías

El backend puede orquestar los jobs agregados en el scraper para recuperar categorías sin ejecutar el scrape completo de productos.

Endpoints admin:

- `POST /api/admin/scraper/categories/restore-official`
- `POST /api/admin/scraper/categories/reorganize`

Flujo recomendado ante categorías corruptas o incompletas:

1. Ejecutar restore oficial para restaurar `configs.discoveredCategories` desde `rubros.js` en el scraper.
2. Ejecutar reorganización con `dryRun: true`.
3. Revisar `/api/admin/scraper/status` o `/api/admin/scraper/history`.
4. Ejecutar reorganización con `dryRun: false`.
5. Para futuros scrapes completos por categoría, enviar `useAutoDiscovery: false` al `categoryScraper` desde `/api/admin/scraper/trigger`.

Estos jobs se persisten en `ScraperJob` con tipos `categoriesRestore` y `categoriesReorganize`. No actualizan `last_update` del catálogo porque no representan una actualización comercial de productos.

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
