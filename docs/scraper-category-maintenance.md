# Mantenimiento seguro de categorías desde backend

Este documento describe cómo el backend Express orquesta los jobs de mantenimiento agregados en el microservicio scraper.

## Contexto

El scraper expone herramientas para recuperar y reorganizar categorías sin ejecutar el scrape completo de productos. El backend no modifica productos directamente: solamente dispara jobs en el scraper, envía `WEBHOOK_URL` y persiste el historial recibido por webhook.

## Endpoints admin del backend

Todas estas rutas cuelgan de `/api/admin/scraper` y requieren autenticación admin.

### `POST /api/admin/scraper/categories/restore-official`

Restaura en el scraper la configuración `configs.discoveredCategories` usando `rubros.js` como fuente oficial.

Body opcional:

```json
{}
```

Respuesta esperada:

```json
{
  "message": "Restauración de categorías oficiales encolada/iniciada",
  "result": {
    "status": "accepted",
    "queued": false,
    "jobId": "categoriesRestore-..."
  }
}
```

### `POST /api/admin/scraper/categories/reorganize`

Dispara el job del scraper que recorre páginas de listado por rubro y actualiza solo la categoría de productos existentes.

Body recomendado para simulación:

```json
{
  "categoryIds": "all",
  "pageDelay": 1500,
  "dryRun": true
}
```

Body recomendado para aplicar cambios:

```json
{
  "categoryIds": "all",
  "pageDelay": 1500,
  "dryRun": false
}
```

Campos:

| Campo | Tipo | Default | Descripción |
|---|---|---|---|
| `categoryIds` | `"all" | number | number[]` | `"all"` | Rubros a procesar. |
| `pageDelay` | `number` | definido por scraper | Delay entre páginas de categoría. |
| `dryRun` | `boolean` | `false` | Si es `true`, detecta sin actualizar MongoDB. |

## Flujo recomendado ante categorías corruptas

1. Ejecutar `POST /api/admin/scraper/categories/restore-official`.
2. Ejecutar `POST /api/admin/scraper/categories/reorganize` con `dryRun: true`.
3. Revisar `/api/admin/scraper/status` o `/api/admin/scraper/history`.
4. Ejecutar `POST /api/admin/scraper/categories/reorganize` con `dryRun: false`.
5. Para futuros scrapes completos, usar `POST /api/admin/scraper/trigger` con:

```json
{
  "scraperType": "categoryScraper",
  "categoryIds": "all",
  "useAutoDiscovery": false
}
```

## Historial y webhooks

Los jobs se guardan en `ScraperJob` con tipos:

- `categoriesRestore`
- `categoriesReorganize`

El backend normaliza y persiste métricas específicas:

- `total`
- `processed`
- `errors`
- `pagesVisited`
- `matched`
- `modified`
- `dryRun`
- `durationMs`

Estos jobs no actualizan `last_update` porque no representan una actualización comercial completa del catálogo.

## Variables de entorno

El backend puede derivar los endpoints desde `SCRAPER_URL`:

```env
SCRAPER_URL=http://localhost:3001/api/scraper
```

También se pueden configurar URLs explícitas:

```env
SCRAPER_CATEGORIES_RESTORE_URL=http://localhost:3001/api/scraper/categories/restore-official
SCRAPER_CATEGORIES_REORGANIZE_URL=http://localhost:3001/api/scraper/categories/reorganize
```

`WEBHOOK_URL` sigue siendo obligatorio para recibir eventos del scraper:

```env
WEBHOOK_URL=http://localhost:3000/api/webhook/scraper/result
SCRAPER_WEBHOOK_SECRET=change-me
```

`SCRAPER_WEBHOOK_SECRET` debe configurarse con el mismo valor en backend y scraper. El scraper debe enviarlo en el header `X-Webhook-Secret` al llamar los webhooks del backend.

## Seguridad del cambio

El backend no ejecuta reorganización local, no toca precios, no toca imágenes y no modifica productos por cuenta propia. Toda la operación real ocurre en el microservicio scraper.
