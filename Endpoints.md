> IMPORTANTE: Todas las rutas aquí documentadas requieren autenticación de administrador mediante JWT.
>
>
> El admin debe loguearse en `/auth/login` y utilizar el token en las siguientes llamadas.
>

---

## Autenticación

### POST `/auth/login`

- **Descripción:** Autentica al usuario administrador y devuelve un token JWT.
- **Body:**

    ```json
    {
      "username": "admin",
      "password": "supersegura123"
    }
    
    ```

- **Response:**

    ```json
    { "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
    
    ```

- **Errores:**

    ```json
    { "error": "Credenciales incorrectas" }
    
    ```


---

## 1. `/api/config`

### GET `/api/config/profit`

- **Descripción:** Devuelve el margen de ganancia actual configurado en el sistema.
- **Response:**

    ```json
    { "margin": 1.27 }
    
    ```


---

### PUT `/api/config/profit`

- **Descripción:** Actualiza el margen de ganancia para el cálculo de precios.
- **Body:**

    ```json
    { "margin": 1.35 }
    
    ```

- **Response:**

    ```json
    { "message": "Profit margin actualizado", "margin": 1.35 }
    
    ```


---

### GET `/api/config/last-update`

- **Descripción:** Devuelve la fecha de la última actualización del catálogo.
- **Response:**

    ```json
    { "lastUpdate": "2025-09-16T22:41:32Z" }
    
    ```


---

## 2. `/api/products/parsed`

### POST `/api/products/parsed`

- **Descripción:** Actualiza el catálogo parseado desde el archivo XLS remoto (trigger manual).
- **Body:***No requiere parámetros*
- **Response:**

    ```json
    {
      "updatedCount": 425,
      "message": "Catálogo actualizado correctamente",
      "details": {
        "timestamp": "2025-09-17T02:00:00Z"
      }
    }
    
    ```


---

## 3. `/api/products/scrape`

### POST `/api/products/scrape`

- **Descripción:** Ejecuta el scraper de productos y categorías (trigger manual desde el dashboard admin).
- **Body:**

    ```json
    {
      "scraperType": "categoryScraper",
      "categoryId": 8
    }
    
    ```

- **Response:**

    ```json
    {
      "message": "Scraper iniciado",
      "scraperType": "categoryScraper",
      "result": { "jobId": "scraper-20250917-001", "status": "pending" }
    }
    
    ```


---

## 4. `/api/webhook/scraper`

### POST `/api/webhook/scraper`

- **Descripción:** Recibe notificación de finalización del scraper.
- **Body:**

    ```json
    {
      "jobId": "scraper-20250917-001",
      "status": "finished",
      "stats": {
        "productsAdded": 84,
        "durationSeconds": 42
      }
    }
    
    ```

- **Response:**

    ```json
    {
      "ok": true,
      "message": "Notificación recibida",
      "updatedCatalog": true
    }
    
    ```


---

## 5. `/api/orders`

### GET `/api/orders`

- **Descripción:** Devuelve todos los pedidos registrados (requiere admin).
- **Response:**

    ```json
    [
      {
        "orderId": "ORD-20250917-001",
        "customerInfo": { "nombre": "Juan Perez", "email": "juan@email.com" },
        "items": [ { "product_id": "A123", "name": "Cinta aisladora", "qty": 2, "price": 350 } ],
        "total": 700,
        "status": "pendiente",
        "address": "Calle Falsa 123"
      }
    ]
    
    ```


---

### GET `/api/orders/:id`

- **Descripción:** Devuelve pedido por ID (requiere admin).
- **URL Param:** `id` (string)
- **Response:**

    ```json
    {
      "orderId": "ORD-20250917-001",
      "customerInfo": { "nombre": "Juan Perez", "email": "juan@email.com" },
      "items": [ { "product_id": "A123", "name": "Cinta aisladora", "qty": 2, "price": 350 } ],
      "total": 700,
      "status": "pendiente",
      "address": "Calle Falsa 123"
    }
    
    ```


---

### PUT `/api/orders/:id`

- **Descripción:** Actualiza un pedido completo (requiere admin).
- **URL Param:** `id`
- **Body:**

    ```json
    {
      "customerInfo": { "nombre": "Juan Perez", "email": "juan@email.com" },
      "items": [ { "product_id": "A123", "name": "Cinta aisladora", "qty": 3, "price": 350 } ],
      "total": 1050,
      "status": "procesado",
      "address": "Calle Falsa 123"
    }
    
    ```

- **Response:**

    ```json
    {
      "status": "success",
      "message": "Pedido actualizado",
      "order": {
        "orderId": "ORD-20250917-001",
        "customerInfo": { "nombre": "Juan Perez", "email": "juan@email.com" },
        "items": [ { "product_id": "A123", "name": "Cinta aisladora", "qty": 3, "price": 350 } ],
        "total": 1050,
        "status": "procesado",
        "address": "Calle Falsa 123"
      }
    }
    
    ```


---

### DELETE `/api/orders/:id`

- **Descripción:** Elimina un pedido (requiere admin).
- **URL Param:** `id`
- **Response:**

    ```json
    {
      "status": "success",
      "message": "Pedido eliminado"
    }
    
    ```


---

### PATCH `/api/orders/:id/status`

- **Descripción:** Actualiza solo el estado de un pedido (requiere admin).
- **URL Param:** `id`
- **Body:**

    ```json
    { "status": "enviado" }
    
    ```

- **Response:**

    ```json
    {
      "status": "success",
      "message": "Estado del pedido actualizado",
      "order": {
        "orderId": "ORD-20250917-001",
        "status": "enviado"
      }
    }
    
    ```


---