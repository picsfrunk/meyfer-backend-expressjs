# AGENTS: Guidance for AI coding agents working on this repo

Purpose: give an AI agent the minimal, concrete knowledge needed to make safe, correct, and high-impact edits.

- Big picture
  - Small Express.js API that centralizes three responsibilities: (A) parse & serve a product catalog from a remote Excel file, (B) orchestrate/monitor external scraper & price-check microservices, and (C) manage customer orders + admin/customer email notifications. See `src/app.js`, `src/services/products.service.js`, `src/services/scraper_monitor.service.js`, `src/services/orders.service.js`.
  - Data: MongoDB is the single source of truth for parsed sections (`src/models/sections.model`), scraped products (`src/models/products.model`), orders (`src/models/order.model`), scraper jobs (`src/models/scraper_job.model`), and price-check snapshots read by admin endpoints (`src/models/price_check_result.model`). DB connection is created in `src/database/mongo.js`.

- Key patterns & conventions (do this project-specific way)
  - Controller → Service: controllers are thin and delegate to services. Example: `src/controllers/products.controller.js` calls `ProductsService.*` and maps thrown {statusCode, message, details} to HTTP responses.
  - Error objects: many services throw plain Error or an object like { statusCode, message, details }. Controllers expect that pattern — preserve it when adding services or refactoring.
  - Route-level admin auth: sensitive routes are mounted with `authenticateAdmin` in `src/routes/api.routes.js` (e.g. `/config`, `/dev`, `/admin/scraper`, `/admin/price-check`, `/admin/products`). Keep this boundary at route mount level.
  - Multipart uploads: file uploads use multer memoryStorage (no disk). Handlers expect `req.file?.buffer` and pass buffers to `uploadProductImage(buffer, productId)` in `src/services/cloudinary.service.js`.
  - Cloudinary usage: images use public_id `product_<productId>` inside folder `meyfer/products` and overwrite on update (see `src/services/cloudinary.service.js`). Don’t change public_id convention unless updating both upload and delete logic.
  - Excel parsing: the XLS parser reads the first sheet and starts at row offset 15: `XLSX.utils.sheet_to_json(..., range: 15)` in `src/services/products.service.js`. The parsing logic and grouping live in `src/services/parser.service.js` and `src/utils/sectionsData.js`.
  - Profit margin config: current profit comes from a Config model key `profitMargin` (fallback DEFAULT_PROFIT in `src/utils/constants.js`). Price calculations use this value centrally (see `getCurrentProfitMargin` and `calcFinalPrice`).
  - Scraper integration: back-end calls external scraper APIs using env vars like `CATEGORY_SCRAPER_URL`, `SITEMAP_SCRAPER_URL`, `SITEMAP_ANALYSIS_URL`, `PRICE_CHECK_URL`, and callback/status envs `WEBHOOK_URL`, `WEBHOOK_PRICE_CHECK_URL`, `SCRAPER_STATUS_URL`. Webhooks are expected at `/api/webhook/scraper/result` and `/api/webhook/price-check/result` (`src/routes/webhooks.routes.js`, `src/controllers/webhook.controller.js`).
  - Scraper monitoring: there is an in-memory live snapshot synchronized by webhooks and persisted job history in Mongo (`src/services/scraper_monitor.service.js`). When editing, do not assume the snapshot is persistent across process restarts.
  - Price-check monitoring: admin read endpoints use Mongo collection `price_check_results` directly via `PriceCheckResult` model (`src/services/price_check_monitor.service.js`), not scraper HTTP APIs.

- Environment & run workflows (concrete commands)
  - Start locally (Node): create an `.env` and run:

    npm run dev

    - `dev` script: `cross-env NODE_ENV=development nodemon index.js` (see `package.json`).
  - Use Docker for local DB: `docker-compose up -d` will start `mongodb-dev` (exposes 27018) and `mongo-express` (8081). Repo includes `docker-compose.yml` configured for these services.
  - Important env names: code expects `MONGODB_URI_DEV` and `MONGODB_URI_PROD` (in `src/database/mongo.js`) — README mentions `MONGO_URI` but the code uses the `_DEV/_PROD` names. Set `NODE_ENV=development` to make the code use `MONGODB_URI_DEV`.
  - Example minimal `.env` for development:

    NODE_ENV=development
    PORT=3000
    MONGODB_URI_DEV=mongodb://localhost:27018/meyfer-catalog
    DB_NAME=meyfer-catalog
    ADMIN_USER=admin
    ADMIN_PASS=admin
    JWT_SECRET=changeme


- Testing / debugging tips
  - Use `mongo-express` at http://localhost:8081 to inspect collections after running `docker-compose up -d`.
  - Trigger a catalog refresh with the admin endpoint that calls `updateCatalogFromXls` (see `src/controllers/products.controller.js` and admin routes in `src/routes/admin_products.routes.js`).
  - When debugging scraper interactions, inspect webhook logs — webhooks are handled in `src/controllers/webhook.controller.js` and will call `scraper_monitor.service` handlers (enqueued/started/finished).
  - For monitoring UIs, validate both admin flows: scraper queue/history at `/api/admin/scraper/*` and price-check snapshots at `/api/admin/price-check/*`.

- Making changes safely (rules for AI agents)
  - Preserve public contracts: do not rename env vars, DB field names, or Cloudinary public_id formats unless you update every reference.
  - Keep controller behavior: controllers generally catch service throws and map to res.status(error.statusCode || 500).json(...). When adding new services, follow the same throw shape `{statusCode, message, details}`.
  - Keep uploads in memory: `multer.memoryStorage()` is an explicit choice (avoids disk). If you change to disk storage, update all code paths that assume buffers.
  - Add instrumentation, not silent failures: services often log and then throw. When catching low-level errors, prefer wrapping with contextual message and original details (consistent with existing code).

- Files to inspect first (quick map)
  - App entry / server: `index.js`, `src/app.js`
  - DB: `src/database/mongo.js`
  - Core domain: `src/services/products.service.js`, `src/services/parser.service.js`, `src/utils/constants.js`
  - Scraper & webhooks: `src/services/scraper_monitor.service.js`, `src/controllers/webhook.controller.js`, `src/routes/webhooks.routes.js`
  - Price check snapshots: `src/services/price_check_monitor.service.js`, `src/models/price_check_result.model.js`, `src/routes/admin_price_check.routes.js`
  - Orders & notifications: `src/services/orders.service.js`, `src/models/order.model.js`, `src/services/email.service.js`
  - Uploads/images: `src/middlewares/upload.middleware.js`, `src/services/cloudinary.service.js`, `src/routes/admin_products.routes.js`
  - Auth & admin: `src/services/auth.service.js`, `src/middlewares/auth.middleware.js`, `src/routes/api.routes.js`

Keep this file short and concrete. If you need environment examples or request payload examples, consult `README.md` and `MeyFer.postman_collection.json` in repo root.
