# 🚀 Meyfer API - Documentación de Endpoints

**Base URL:** `{{URL}}/api`  
**Autenticación:** Header `Authorization: Bearer <token>` requerido para todas las rutas `/admin`, `/config`, `/dev`.

---

## 🔐 Autenticación
### `POST /auth/login`
Autentica al administrador.
- **Body:** `{ "username": "...", "password": "..." }`
- **Response:** `{ "token": "JWT_TOKEN" }`

---

## 🛒 Productos (Público)
### `GET /products/parsed`
Obtiene el catálogo estructurado desde el archivo Excel.

### `GET /products/scraped`
Obtiene productos scrapeados de la base de datos con paginación y filtros.
- **Query Params:** `page`, `limit`, `brand`, `category_id`, `search`.

### `GET /products/scraped/:id`
Detalle técnico de un producto específico.

### `GET /products/brands`
Lista de marcas detectadas en el análisis del sitio.

### `GET /categories`
Lista de categorías con conteo de productos.

---

## 📦 Pedidos (Orders)
### `POST /orders/new` (Pública)
Registra un nuevo pedido y dispara notificaciones por email.
- **Body:** `{ "customerInfo": {...}, "cartItems": [...] }`
- **Response 201:**
```json
{
  "orderId": "MF-001",
  "status": "success",
  "message": "Pedido recibido correctamente"
}
```

### `GET /orders` (Admin)
Lista de pedidos con filtros.
- **Query Params:** `status` (uno o varios separados por coma, ej. `Pendiente,Procesado`), `populate` (true/false).

### `GET /orders/statuses` (Admin)
Devuelve los estados de pedido válidos definidos en el modelo.
- **Response 200:**
```json
{
  "statuses": ["Pendiente", "Procesado", "Enviado", "Entregado", "Cancelado", "Eliminado"],
  "defaultStatus": "Pendiente"
}
```

### `GET /orders/:id` (Admin)
Detalle de un pedido por ID.

### `PUT /orders/:id` (Admin)
Actualización completa de un pedido.

### `PATCH /orders/:id/status` (Admin)
Cambiar el estado de un pedido. Solo acepta valores del enum del modelo.
- **Body:**
```json
{ "status": "Enviado" }
```
- **Response 200:**
```json
{
  "status": "success",
  "message": "Estado del pedido actualizado",
  "order": { "orderId": "MF-001", "status": "Enviado", "..." }
}
```
- **Response 400 — estado ausente:**
```json
{ "message": "El estado del pedido es requerido" }
```
- **Response 400 — estado inválido:**
```json
{
  "message": "Estado de pedido no válido",
  "allowedStatuses": ["Pendiente", "Procesado", "Enviado", "Entregado", "Cancelado", "Eliminado"]
}
```
- **Response 404:**
```json
{ "message": "Pedido no encontrado" }
```

### `DELETE /orders/:id` (Admin)
Soft delete (cambia estado a `deleted`).

### `POST /orders/:orderId/resend-emails` (Admin)
Reenvío manual de correos de confirmación.
- **Body:** `{ "admin": boolean, "customer": boolean }`

---

## ⚙️ Configuración y Sistema (Admin)
### `GET /config/profit`
Margen de ganancia actual.

### `PUT /config/profit`
Actualiza el margen y recalcula automáticamente todos los `final_price`.
- **Body:** `{ "margin": number }`

### `GET /config/last-update`
Fecha de la última sincronización exitosa.

### `GET /config/admin-emails`
Lista de emails que reciben notificaciones del sistema.

### `POST /config/admin-emails`
Agrega un nuevo admin/vendedor.
- **Body:** `{ "email": "...", "role": "admin" | "seller" }`

---

## 🤖 Administración de Scrapers & Precios (Admin)
### `GET /admin/scraper/status`
Estado en tiempo real de la cola de procesamiento.

### `GET /admin/scraper/stats`
Métricas de rendimiento (Jobs completados, fallidos, duración media).

### `GET /admin/scraper/history`
Historial paginado de ejecuciones.

### `POST /admin/scraper/trigger`
Dispara manualmente un scraper.
- **Body:** `{ "scraperType": "sitemapScraper" | "categoryScraper", ...params }`

### `POST /config/price-check`
Inicia el monitor de comparación de precios contra la competencia.

### `GET /admin/price-check/latest`
Obtiene el último reporte de cambios de precios generado.

---

## 🖼️ Gestión Manual de Productos (Admin)
### `POST /admin/products`
Crea un producto manual con carga de imagen a Cloudinary.
- **Content-Type:** `multipart/form-data`
- **Body:** `image` (File), `display_name`, `list_price`, `category_id`.

### `PUT /admin/products/:productId`
Actualiza datos o imagen de un producto manual.

### `DELETE /admin/products/:productId`
Elimina el producto de la DB y su imagen de Cloudinary.

---

## 🛠️ Desarrollo (Dev)
### `POST /dev/test-email`
Envía un correo de prueba para verificar la integración con Mailjet.