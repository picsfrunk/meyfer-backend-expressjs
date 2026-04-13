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

El cliente **debe existir** en la base de datos y se referencia únicamente por su `customerCode`. El snapshot de datos del cliente (nombre, CUIT, email, etc.) se construye siempre desde la DB, no desde el body. La dirección de entrega es opcional: si se envía con al menos un campo no vacío se usa; de lo contrario se usa la dirección registrada del cliente.

> **Nota:** el `customerCode` se normaliza automáticamente a mayúsculas en el backend. Se recomienda enviarlo en mayúsculas para mayor claridad (ej. `"FE78X3"` en lugar de `"fe78x3"`).

- **Body:**
```json
{
  "customerInfo": {
    "customerCode": "FE78X3"
  },
  "deliveryAddress": {
    "calle": "Av. Corrientes",
    "numero": "1234",
    "localidad": "CABA"
  },
  "cartItems": [
    {
      "productCartItem": { "product_id": "1528" },
      "qty": 2,
      "priceAtPurchase": 1500
    }
  ],
  "extraCharge": 500
}
```
- **Response 201:**
```json
{
  "orderId": "MF-001",
  "status": "success",
  "message": "Pedido recibido correctamente"
}
```
- **Response 400 — customerCode ausente:**
```json
{
  "status": "error",
  "code": "MISSING_CUSTOMER_CODE",
  "message": "El código de cliente es requerido"
}
```
- **Response 400 — cartItems inválido (varios casos posibles):**
```json
{ "status": "error", "message": "cartItems debe ser un array" }
```
```json
{ "status": "error", "message": "El pedido debe tener al menos un producto" }
```
```json
{ "status": "error", "message": "Cada item debe incluir product_id" }
```
```json
{ "status": "error", "message": "La cantidad de cada item debe ser un entero mayor o igual a 1" }
```
```json
{ "status": "error", "message": "El precio por item debe ser un número mayor o igual a 0" }
```
```json
{ "status": "error", "message": "El recargo extra debe ser un número mayor o igual a 0" }
```
- **Response 404 — cliente no encontrado:**
```json
{
  "status": "error",
  "code": "CUSTOMER_NOT_FOUND",
  "message": "Cliente no encontrado"
}
```

### `GET /orders` (Admin)
Lista de pedidos con filtros.
- **Query Params:** `status` (uno o varios separados por coma, ej. `pending,confirmed`), `populate` (true/false).

### `GET /orders/statuses` (Admin)
Devuelve los estados de pedido válidos definidos en el modelo.
- **Response 200:**
```json
{
  "statuses": ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "deleted"],
  "defaultStatus": "pending"
}
```

### `GET /orders/:id` (Admin)
Detalle de un pedido por ID.

### `PUT /orders/:id` (Admin)
Actualización de pedido (permite editar `customerInfo`, `deliveryAddress`, ítems y precios).
- Campos actualizables: `customerInfo`, `deliveryAddress`, `cartItems`/`items`, `extraCharge`, `status`.
- Si se envía `customerInfo`, se mergea con los datos actuales (solo se sobreescriben los campos enviados). **Nota:** `customerInfo` NO tiene campo `direccion`; la dirección de entrega se gestiona con `deliveryAddress` en el nivel raíz del pedido.
- Si se envía `deliveryAddress`, se mergea campo a campo con la dirección actual.
- Si se envía `cartItems`/`items` y/o `extraCharge`, el backend recalcula `total` y `totalItems`.

### `PATCH /orders/:id/pricing` (Admin)
Actualiza precios/cantidades de un pedido y recargo extra (ej. flete) recalculando totales.
- **Body:**
```json
{
  "cartItems": [
    {
      "productCartItem": { "product_id": "1528" },
      "qty": 3,
      "priceAtPurchase": 2500
    }
  ],
  "extraCharge": 1200
}
```

### `PATCH /orders/:id/status` (Admin)
Cambiar el estado de un pedido. Solo acepta valores del enum del modelo.
- **Body:**
```json
{ "status": "shipped" }
```
- **Response 200:**
```json
{
  "status": "success",
  "message": "Estado del pedido actualizado",
  "order": { "orderId": "MF-001", "status": "shipped", "..." }
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
  "allowedStatuses": ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "deleted"]
}
```
- **Response 404:**
```json
{ "message": "Pedido no encontrado" }
```

### `DELETE /orders/:id` (Admin)
Soft delete (cambia estado a `"deleted"`).

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

## 👥 Clientes (Admin)
> Todas las rutas requieren `Authorization: Bearer <token>`.

### `GET /admin/customers`
Lista todos los clientes ordenados por fecha de creación descendente.

### `GET /admin/customers/:id`
Detalle de un cliente por su `_id` de MongoDB.

### `POST /admin/customers`
Crea un cliente manualmente. El campo `customerCode` se genera automáticamente (no se acepta en el body).
- **Body:**
```json
{
  "cliente": "Nombre / empresa",
  "razonSocial": "Razón Social S.A.",
  "cuit": "20-12345678-9",
  "contacto": "Juan Pérez",
  "email": "cliente@ejemplo.com",
  "telefono1": "11-1234-5678",
  "direccion": {
    "calle": "Av. Corrientes",
    "numero": "1234",
    "piso": "3",
    "timbre": "B",
    "entreCalles": "Callao y Montevideo",
    "localidad": "CABA",
    "partido": "CABA"
  },
  "horarios": "Lunes a Viernes 9-18h",
  "notas": "Llamar antes de entregar"
}
```
- **Response 201:** `{ "status": "success", "customer": { "customerCode": "FE78X3", ... } }`
- **Response 409:** `{ "status": "error", "message": "Ya existe un cliente con ese CUIT o email" }`

### `PUT /admin/customers/:id`
Actualiza los datos de un cliente existente.
- **Body:** mismos campos que POST (parcial o completo).
- **Response 200:** `{ "status": "success", "customer": {...} }`

### `POST /admin/customers/:id/regenerate-code` (Admin)
Regenera el `customerCode` de un cliente existente (útil si el código generado automáticamente no es conveniente).
- **Body:** vacío
- **Response 200:** `{ "status": "success", "customerCode": "AB12CD" }`
- **Response 404:** `{ "status": "error", "message": "Cliente no encontrado" }`

### `DELETE /admin/customers/:id`
Elimina definitivamente un cliente.
- **Response 200:** `{ "status": "success", "message": "Cliente eliminado" }`

> **Vinculación con pedidos:** al recibir un pedido (`POST /orders/new`), el backend busca al cliente
> por su `customerCode`. Si no existe o no se proporciona el código, el pedido es rechazado (400/404).
> El campo `customerInfo` del pedido se guarda como snapshot tipado (`CustomerSnapshotSchema`) con los
> datos actuales de la DB (nunca del body). El campo `deliveryAddress` almacena la dirección de entrega
> efectiva (del payload si viene, sino la del cliente).

---

## 🛠️ Desarrollo (Dev)
### `POST /dev/test-email`
Envía un correo de prueba para verificar la integración con Mailjet.
