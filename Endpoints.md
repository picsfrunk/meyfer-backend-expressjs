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

`customerNote` es una observación libre opcional escrita por el cliente para ese pedido. Se guarda como string con `trim()`; si no se envía, queda `""`. Para compatibilidad temporal, el backend también acepta `notes`, `note`, `notas` o `customerInfo.notas`, pero siempre persiste el valor normalizado en `customerNote`. No guardar esta observación dentro de `customerInfo` ni `delivery`; `delivery.schedule` sigue siendo solo el horario o ventana de entrega.

> **Nota:** el `customerCode` se normaliza automáticamente a mayúsculas en el backend. Se recomienda enviarlo en mayúsculas para mayor claridad (ej. `"FE78X3"` en lugar de `"fe78x3"`).

- **Body:**
```json
{
  "customerInfo": {
    "customerCode": "FE78X3"
  },
  "customerNote": "Entregar después de las 15 hs, tocar timbre dos veces",
  "delivery": {
    "address": {
      "calle": "Av. Corrientes",
      "numero": "1234",
      "localidad": "CABA"
    },
    "schedule": "Lunes a viernes de 15 a 18"
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
  "message": "Pedido recibido correctamente",
  "order": {
    "orderId": "MF-001",
    "customerNote": "Entregar después de las 15 hs, tocar timbre dos veces",
    "customerInfo": { "customerCode": "FE78X3" },
    "delivery": { "schedule": "Lunes a viernes de 15 a 18" },
    "status": "pending"
  }
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
- Cada pedido incluye `customerNote`. En documentos antiguos sin el campo, se devuelve como `""`.

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
- La respuesta incluye `customerNote`. En documentos antiguos sin el campo, se devuelve como `""`.

### Bitácora interna de pedidos `OrderLog` (Admin)
Notas internas de seguimiento operativo asociadas a un pedido. Se guardan en una colección separada (`OrderLog`), no como array dentro de `Order`.

No confundir con `customerNote`: `customerNote` lo escribe el cliente al crear el pedido; la bitácora la usa el equipo/admin para seguimiento interno.

La bitácora contiene notas manuales (`type: "note"`) y eventos automáticos generados cuando se modifica el pedido:

- `status_change`: cambio de estado.
- `delivery_change`: cambio en datos de entrega.
- `pricing_change`: cambios en productos, cantidades, precios, recargo extra o totales.
- `customer_note_change`: cambio en la observación del cliente.
- `customer_info_change`: cambio en datos del cliente guardados en el pedido.
- `order_deleted`: eliminación lógica del pedido.

Los eventos automáticos se crean con `createdBy: "system"` y pueden incluir `metadata` con valores anteriores y nuevos.

#### `GET /orders/:orderId/logs`
Lista los logs no eliminados de un pedido, ordenados por `createdAt` descendente.

- **Response 200:**
```json
[
  {
    "_id": "665f1a0f6d0a4c2f9a8b1234",
    "orderId": "MF-001",
    "message": "Cliente pidió coordinar entrega por la tarde",
    "type": "note",
    "createdBy": "admin",
    "isDeleted": false,
    "createdAt": "2026-05-03T18:30:00.000Z"
  },
  {
    "_id": "665f1a0f6d0a4c2f9a8b5678",
    "orderId": "MF-001",
    "message": "Estado cambiado de pending a confirmed",
    "type": "status_change",
    "createdBy": "system",
    "metadata": {
      "from": "pending",
      "to": "confirmed"
    },
    "isDeleted": false,
    "createdAt": "2026-05-03T18:35:00.000Z"
  }
]
```
- **Response 404 — pedido no encontrado:**
```json
{ "status": "error", "message": "Pedido no encontrado" }
```

#### `POST /orders/:orderId/logs`
Crea una nota interna para un pedido existente. Valida que el pedido exista antes de crear el log.

- **Body:**
```json
{
  "message": "Cliente pidió coordinar entrega por la tarde",
  "type": "note",
  "createdBy": "admin"
}
```
- **Reglas:**
  - `message` es obligatorio.
  - `message` se normaliza con `String(message).trim()`.
  - Si `message` queda vacío, responde `400`.
  - `type` default: `"note"`.
  - `createdBy` default: `"admin"`.
- **Response 201:**
```json
{
  "status": "success",
  "message": "Nota interna creada",
  "log": {
    "_id": "665f1a0f6d0a4c2f9a8b1234",
    "orderId": "MF-001",
    "message": "Cliente pidió coordinar entrega por la tarde",
    "type": "note",
    "createdBy": "admin",
    "metadata": null,
    "isDeleted": false,
    "createdAt": "2026-05-03T18:30:00.000Z"
  }
}
```
- **Response 400 — message ausente o vacío:**
```json
{ "status": "error", "message": "message es obligatorio" }
```
- **Response 404 — pedido no encontrado:**
```json
{ "status": "error", "message": "Pedido no encontrado" }
```

#### `PATCH /orders/:orderId/logs/:logId`
Edita una nota interna no eliminada.

- **Body:**
```json
{
  "message": "Entrega coordinada para mañana por la tarde",
  "updatedBy": "admin"
}
```
- **Response 200:**
```json
{
  "status": "success",
  "message": "Nota interna actualizada",
  "log": {
    "_id": "665f1a0f6d0a4c2f9a8b1234",
    "orderId": "MF-001",
    "message": "Entrega coordinada para mañana por la tarde",
    "type": "note",
    "createdBy": "admin",
    "updatedBy": "admin",
    "metadata": null,
    "isDeleted": false,
    "createdAt": "2026-05-03T18:30:00.000Z",
    "updatedAt": "2026-05-03T19:00:00.000Z"
  }
}
```
- **Response 400 — message ausente o vacío:**
```json
{ "status": "error", "message": "message es obligatorio" }
```
- **Response 404 — log no encontrado:**
```json
{ "status": "error", "message": "Nota interna no encontrada" }
```

#### `DELETE /orders/:orderId/logs/:logId`
Elimina una nota interna con soft delete. Marca `isDeleted: true`, completa `deletedAt` y deja de aparecer en el listado.

- **Response 200:**
```json
{
  "status": "success",
  "message": "Nota interna eliminada"
}
```
- **Response 404 — log no encontrado:**
```json
{ "status": "error", "message": "Nota interna no encontrada" }
```

#### Ejemplo de `pricing_change` automático
Se genera al actualizar ítems, cantidades, precios o `extraCharge` mediante endpoints de modificación del pedido.

```json
{
  "_id": "665f1a0f6d0a4c2f9a8b9012",
  "orderId": "MF-001",
  "message": "Cambios de productos/precios: 1 producto(s) agregado(s), 1 producto(s) modificado(s), cargo extra de 500 a 800",
  "type": "pricing_change",
  "createdBy": "system",
  "metadata": {
    "items": {
      "added": [
        { "product_id": "1528", "quantity": 2, "priceAtPurchase": 1500 }
      ],
      "removed": [],
      "updated": [
        {
          "product_id": "999",
          "changes": {
            "quantity": { "from": 1, "to": 3 },
            "priceAtPurchase": { "from": 1000, "to": 1200 }
          }
        }
      ]
    },
    "extraCharge": { "from": 500, "to": 800 },
    "total": { "from": 2500, "to": 5600 },
    "totalItems": { "from": 2, "to": 5 }
  },
  "isDeleted": false,
  "createdAt": "2026-05-03T19:15:00.000Z"
}
```

### `PUT /orders/:id` (Admin)
Actualización de pedido (permite editar `customerInfo`, `customerNote`, `delivery`, ítems y precios).
- Campos actualizables: `customerInfo`, `customerNote`, `delivery`, `cartItems`/`items`, `extraCharge`, `status`.
- Si se envía `customerNote`, se normaliza a string con `trim()` antes de persistir.
- Si se envía `customerInfo`, se mergea con los datos actuales (solo se sobreescriben los campos enviados). **Nota:** `customerInfo` NO tiene campo `direccion`; la dirección de entrega se gestiona con `delivery.address`.
- Si se envía `delivery`, se mergea campo a campo con los datos de entrega actuales. `delivery.schedule` representa solo horario/ventana de entrega.
- Si se envía `cartItems`/`items` y/o `extraCharge`, el backend recalcula `total` y `totalItems`.
- Los cambios efectivos generan logs automáticos en la bitácora del pedido.

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
- Si hay cambios efectivos de productos, precios, cantidades, `extraCharge` o totales, genera un log automático `pricing_change`.

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
- Si el estado cambia efectivamente, genera un log automático `status_change`.
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

### `PATCH /orders/:id/delivery` (Admin)
Cambiar los datos de entrega de un pedido.
- **Body:**
```json
{
  "delivery": {
    "address": {
      "calle": "Av. Siempre Viva",
      "numero": "742",
      "piso": "",
      "timbre": "",
      "entreCalles": "Primera y Segunda",
      "localidad": "Springfield",
      "partido": "Springfield"
    },
    "contactName": "Homero Simpson",
    "contactPhone": "",
    "schedule": "Lunes a viernes de 9 a 13"
  }
}
```
- Si los datos de entrega cambian efectivamente, genera un log automático `delivery_change`.
- **Response 200:**
```json
{
  "status": "success",
  "message": "Delivery actualizado",
  "order": {
    
  }
}
```
- **Response 404:**
```json
{ "message": "Pedido no encontrado" }
```

### `DELETE /orders/:id` (Admin)
Soft delete (cambia estado a `"deleted"`).
- Si el pedido cambia a `"deleted"`, genera un log automático `order_deleted`.

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

### `DELETE /admin/scraper/jobs/:jobId`
Cancela un job específico por su ID.

- Si el job está **en espera**: se elimina de la cola inmediatamente.
- Si el job está **en ejecución**: se marca para cancelación graceful.
- Si el job ya **terminó**: retorna `400`.
- Si el ID **no existe**: retorna `404`.

#### Response 200 — job en cola
```json
{
  "status": "cancelled",
  "jobId": "priceCheck-1718000000000-4",
  "message": "Job eliminado de la cola",
  "cancelled": true,
  "wasQueued": true
}
```
#### Response 200 — job en ejecución
```json
{
  "status": "cancelling",
  "jobId": "priceCheck-1718000000000-4",
  "message": "Job marcado para cancelación. Se detendrá lo antes posible.",
  "cancelled": true,
  "wasQueued": false
}
```
#### Response 400 — job ya terminó
```json
{
  "status": "error",
  "message": "No se puede cancelar un job que ya terminó",
  "cancelled": false
}
```
#### Response 404 — job no encontrado
```json
{
  "status": "error",
  "message": "Job no encontrado",
  "cancelled": false
}
```

### `DELETE /admin/scraper/jobs/all`

Elimina todos los jobs pendientes de la cola.

Solo afecta jobs en estado enqueued
No interrumpe el job en ejecución
#### Response 200
```json
{
  "status": "purged",
  "message": "3 job(s) pendiente(s) eliminado(s) de la cola.",
  "cancelledCount": 0
}
```

### `GET /admin/scraper/history`
Historial paginado de ejecuciones.

### `POST /admin/scraper/trigger`
Dispara manualmente un scraper.
- **Body:** `{ "scraperType": "sitemapScraper" | "categoryScraper", ...params }`

También acepta parámetros opcionales para corridas limitadas/test mode. El backend los valida, normaliza y reenvía al microservicio scraper:

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

Validaciones:

- `testMode`: boolean.
- `skipImages`: boolean.
- `limitProducts`: entero positivo, máximo `100`.
- `limitCategories`: entero positivo, máximo `5`.

Ejemplo para `sitemapScraper` limitado:

```json
{
  "scraperType": "sitemapScraper",
  "testMode": true,
  "limitProducts": 5,
  "skipImages": true
}
```

`limitProducts` no implica `dryRun`. Una corrida limitada puede persistir esos pocos productos si el scraper real persiste, y el scraper omite limpieza de huérfanos en corridas limitadas. Este modo sirve para pruebas rápidas y validación de webhooks/cancelación.

### `POST /config/price-check`
Inicia el monitor de comparación de precios contra la competencia.

### `GET /admin/price-list-import/settings`
Devuelve la URL configurada de lista de precios y el último estado persistido.

### `PUT /admin/price-list-import/settings`
Guarda la URL configurada de lista de precios.

```json
{
  "sourceUrl": "https://proveedor.example/lista.xlsx"
}
```

### `POST /admin/price-list-import/import-from-url`
Inicia una importación usando la URL guardada. El backend llama al scraper y devuelve el `jobId` generado por el scraper.

### `POST /admin/price-list-import/upload`
Inicia una importación manual con archivo temporal. `Content-Type: multipart/form-data`, campo `file` (`csv`, `xls` o `xlsx`). El backend guarda temporalmente el archivo, llama al scraper con `fileId` y devuelve el `jobId` generado por el scraper.

### `GET /price-list-import/files/:fileId`
Endpoint para que el scraper descargue un archivo temporal. Requiere `X-Webhook-Secret`.

### `POST /webhook/price-list-import/result`
Webhook protegido para recibir el resultado del scraper. Requiere `X-Webhook-Secret`.

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
> datos actuales de la DB (nunca del body). El campo `delivery.address` almacena la dirección de entrega
> efectiva (del payload si viene, sino la del cliente). La observación puntual del cliente se guarda aparte
> en `customerNote`.

---

## 🛠️ Desarrollo (Dev)
### `POST /dev/test-email`
Envía un correo de prueba para verificar la integración con Mailjet.
