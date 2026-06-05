const axios = require('axios');
const XLSX = require('xlsx');
const { EXCEL_URL, DEFAULT_PROFIT } = require("../utils/constants");
const { processSheetItems } = require('./parser.service');
const Section = require('../models/sections.model');
const Config = require('../models/config.model');
const ScrapedProduct = require('../models/products.model');
const SitemapAnalysis = require('../models/sitemap_analysis.model');
const { uploadProductImage, deleteProductImage } = require('./cloudinary.service');

// ─── Helpers internos ────────────────────────────────────────────────────────

const SCRAPER_LIMITS = {
    limitProducts: 100,
    limitCategories: 5,
};

const LIMITED_SCRAPER_PARAMS = ['testMode', 'limitProducts', 'limitCategories', 'skipImages'];

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const normalizeOptionalBoolean = (params, key) => {
    if (!hasOwn(params, key)) return undefined;

    const value = params[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true') return true;
        if (normalized === 'false') return false;
    }

    throw {
        statusCode: 400,
        message: `Parámetro inválido: ${key} debe ser boolean`,
        details: { field: key, value },
    };
};

const normalizeOptionalPositiveInteger = (params, key, max) => {
    if (!hasOwn(params, key)) return undefined;

    const value = params[key];
    const parsed = typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : value;

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw {
            statusCode: 400,
            message: `Parámetro inválido: ${key} debe ser un entero positivo`,
            details: { field: key, value },
        };
    }

    if (parsed > max) {
        throw {
            statusCode: 400,
            message: `Parámetro inválido: ${key} no puede ser mayor a ${max}`,
            details: { field: key, value, max },
        };
    }

    return parsed;
};

const normalizeLimitedScraperParams = (params = {}) => {
    const normalized = { ...params };

    const testMode = normalizeOptionalBoolean(params, 'testMode');
    const skipImages = normalizeOptionalBoolean(params, 'skipImages');
    const limitProducts = normalizeOptionalPositiveInteger(
        params,
        'limitProducts',
        SCRAPER_LIMITS.limitProducts
    );
    const limitCategories = normalizeOptionalPositiveInteger(
        params,
        'limitCategories',
        SCRAPER_LIMITS.limitCategories
    );

    if (testMode !== undefined) normalized.testMode = testMode;
    if (skipImages !== undefined) normalized.skipImages = skipImages;
    if (limitProducts !== undefined) normalized.limitProducts = limitProducts;
    if (limitCategories !== undefined) normalized.limitCategories = limitCategories;

    const hasLimitedParams = LIMITED_SCRAPER_PARAMS.some(key => hasOwn(params, key));
    if (hasLimitedParams) {
        console.log(
            `[scraper-test-mode] forwarding limited scraper run ` +
            `testMode=${normalized.testMode ?? false} ` +
            `limitProducts=${normalized.limitProducts ?? '-'} ` +
            `limitCategories=${normalized.limitCategories ?? '-'} ` +
            `skipImages=${normalized.skipImages ?? false}`
        );
    }

    return normalized;
};

const normalizeImageUrl = (value) => {
    if (typeof value !== 'string') {
        throw {
            statusCode: 400,
            message: 'image_url debe ser una URL valida',
            details: { field: 'image_url' },
        };
    }

    const imageUrl = value.trim();

    if (!imageUrl) {
        throw {
            statusCode: 400,
            message: 'image_url no puede estar vacio',
            details: { field: 'image_url' },
        };
    }

    try {
        const parsed = new URL(imageUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Unsupported protocol');
        }
    } catch (_error) {
        throw {
            statusCode: 400,
            message: 'image_url debe ser una URL http(s) valida',
            details: { field: 'image_url', value },
        };
    }

    return imageUrl;
};

const normalizeImageUrlFields = (safeData, hasImageBuffer = false) => {
    const hasSnakeCase = hasOwn(safeData, 'image_url');
    const hasCamelCase = hasOwn(safeData, 'imageUrl');

    if (hasSnakeCase && hasCamelCase) {
        const snakeCaseUrl = normalizeImageUrl(safeData.image_url);
        const camelCaseUrl = normalizeImageUrl(safeData.imageUrl);

        if (snakeCaseUrl !== camelCaseUrl) {
            throw {
                statusCode: 400,
                message: 'Enviar solo image_url o imageUrl para actualizar la imagen',
                details: { fields: ['image_url', 'imageUrl'] },
            };
        }

        safeData.image_url = snakeCaseUrl;
    }

    if (!hasSnakeCase && hasCamelCase) {
        safeData.image_url = safeData.imageUrl;
    }

    delete safeData.imageUrl;

    if (hasImageBuffer) {
        return;
    }

    if (hasOwn(safeData, 'image_url')) {
        safeData.image_url = normalizeImageUrl(safeData.image_url);
    }
};

/**
 * Obtiene el margen de ganancia vigente desde la config.
 * @returns {Promise<number>} margen en porcentaje (ej: 30)
 */
const getCurrentProfitMargin = async () => {
    const configProfit = await Config.findOne({ key: 'profitMargin' });
    return configProfit?.value ?? DEFAULT_PROFIT;
};

/**
 * Calcula el final_price a partir del list_price y el margen.
 */
const calcFinalPrice = (listPrice, profitPercent) =>
    listPrice * (1 + profitPercent / 100);

// ─── Marcas ──────────────────────────────────────────────────────────────────

const getProductBrands = async () => {
    try {
        const sitemapAnalysis = await SitemapAnalysis.findOne().sort({ analyzedAt: -1 });

        if (sitemapAnalysis && sitemapAnalysis.brands && sitemapAnalysis.brands.length > 0) {
            return sitemapAnalysis.brands
                .filter(brand => brand.id !== null && brand.name)
                .map(brand => ({
                    id: brand.id,
                    name: brand.name,
                    slug: brand.slug,
                    products: brand.products
                }))
                .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        }

        const brandsFromProducts = await ScrapedProduct.distinct('brand', {
            brand: { $ne: null, $ne: '' }
        });

        return brandsFromProducts
            .sort((a, b) => a.localeCompare(b, 'es'))
            .map(brand => ({ name: brand }));

    } catch (error) {
        throw new Error(`Error al obtener las marcas: ${error.message}`);
    }
};

// ─── Secciones / catálogo XLS ────────────────────────────────────────────────

const getSections = async () => {
    try {
        return await Section.find();
    } catch (error) {
        console.error('Error en ProductService al obtener secciones:', error);
        throw { statusCode: 500, message: 'Error al consultar la base de datos', details: error.message };
    }
};

const updateCatalogFromXls = async () => {
    try {
        const response = await axios.get(EXCEL_URL, { responseType: 'arraybuffer' });

        const workbook = XLSX.read(response.data, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetItems = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 15 });

        const profit = await getCurrentProfitMargin();
        const parsedSections = processSheetItems(sheetItems, profit);

        await Section.deleteMany();
        await Section.insertMany(parsedSections);

        await Config.findOneAndUpdate(
            { key: 'last_update' },
            { value: new Date() },
            { upsert: true, new: true }
        );

        return { message: 'Catálogo actualizado correctamente' };

    } catch (error) {
        console.error('Error en ProductService al actualizar catálogo:', error);
        throw { statusCode: 500, message: 'Error al actualizar el catálogo', details: error.message };
    }
};

// ─── Scraper / análisis / price check ────────────────────────────────────────

const runScraper = async (scraperType, params = {}) => {
    const scraperConfig = {
        categoryScraper: process.env.CATEGORY_SCRAPER_URL,
        sitemapScraper:  process.env.SITEMAP_SCRAPER_URL,
    };

    try {
        const scraperUrl = scraperConfig[scraperType];
        if (!scraperUrl) {
            throw { statusCode: 400, message: 'Tipo de scraper inválido o URL no configurada' };
        }

        const normalizedParams = normalizeLimitedScraperParams(params);
        const response = await axios.post(scraperUrl, { webhookUrl: process.env.WEBHOOK_URL, ...normalizedParams });
        return response.data;

    } catch (error) {
        if (error.statusCode) throw error;

        throw {
            statusCode: error.response?.status || 500,
            message: error.message || 'Error desconocido en el scraper',
            details: error.response?.data || null
        };
    }
};

const runSitemapAnalysis = async (params = {}) => {
    try {
        const response = await axios.post(process.env.SITEMAP_ANALYSIS_URL, { ...params });
        return response.data;
    } catch (error) {
        throw {
            statusCode: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || null
        };
    }
};

const runPriceCheck = async () => {
    if (!process.env.PRICE_CHECK_URL)
        throw { statusCode: 503, message: 'PRICE_CHECK_URL no está configurada en el entorno del backend' };
    if (!process.env.WEBHOOK_PRICE_CHECK_URL)
        throw { statusCode: 503, message: 'WEBHOOK_PRICE_CHECK_URL no está configurada en el entorno del backend' };

    try {
        const response = await axios.post(process.env.PRICE_CHECK_URL, {
            webhookUrl: process.env.WEBHOOK_PRICE_CHECK_URL,
        });
        return response.data;
    } catch (error) {
        throw {
            statusCode: error.response?.status || 500,
            message: error.message || 'Error al ejecutar price check',
            details: error.response?.data || null
        };
    }
};

// ─── Listado paginado ────────────────────────────────────────────────────────

const getPaginatedScrapedProducts = async (page = 1, limit = 20, categoryId = null, searchKeyword = null, brand = null) => {
    const skip = (page - 1) * limit;
    const filter = {};

    if (categoryId) filter.category_id = categoryId;

    if (brand && typeof brand === 'string' && brand.trim().length > 0) {
        filter.brand = new RegExp(brand.trim(), 'i');
    }

    if (searchKeyword) {
        const trimmedKeyword = searchKeyword.trim();
        const isNumeric = /^\d+$/.test(trimmedKeyword);

        filter.$or = isNumeric
            ? [
                { product_id: trimmedKeyword },
                { category_id: parseInt(trimmedKeyword) },
                ...buildTextSearchConditions(trimmedKeyword)
              ]
            : buildTextSearchConditions(trimmedKeyword);
    }

    const sort = searchKeyword ? buildSmartSort() : { _id: 1 };

    const [products, total] = await Promise.all([
        ScrapedProduct.find(filter).skip(skip).limit(limit).sort(sort).lean(),
        ScrapedProduct.countDocuments(filter)
    ]);

    return { page, limit, total, totalPages: Math.ceil(total / limit), products };
};

const buildTextSearchConditions = (keyword) => {
    const words = keyword.split(/\s+/).filter(Boolean);
    const wordRegexes = words.map(word => new RegExp(escapeRegex(word), 'i'));
    const phraseRegex = new RegExp(escapeRegex(keyword), 'i');

    const conditions = [
        { display_name: phraseRegex },
        { brand: phraseRegex },
        { product_type: phraseRegex },
        { category_name: phraseRegex },
        { base_unit_name: phraseRegex }
    ];

    for (const regex of wordRegexes) {
        conditions.push({ display_name: regex }, { brand: regex }, { product_type: regex });
    }

    if (words.length > 1) {
        conditions.push({
            $and: wordRegexes.map(regex => ({
                $or: [{ display_name: regex }, { brand: regex }, { product_type: regex }]
            }))
        });
    }

    return conditions;
};

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const buildSmartSort = () => ({ display_name: 1, brand: 1, _id: 1 });

// ─── Producto por ID ─────────────────────────────────────────────────────────

const getScrapedProductById = async (id) => {
    try {
        return await ScrapedProduct.findOne({ product_id: id }).exec();
    } catch (error) {
        throw new Error(`Error al obtener el producto con product_id ${id}: ${error.message}`);
    }
};

// ─── Actualización masiva de precios ─────────────────────────────────────────

const updateProductPrices = async () => {
    try {
        const profit = await getCurrentProfitMargin();
        const profitDecimal = profit / 100;

        const productsToUpdate = await ScrapedProduct.find();
        if (productsToUpdate.length === 0) return { message: 'No hay productos para actualizar.' };

        const bulkOperations = productsToUpdate.map(product => ({
            updateOne: {
                filter: { _id: product._id },
                update: { $set: { final_price: product.list_price * (1 + profitDecimal) } }
            }
        }));

        const result = await ScrapedProduct.bulkWrite(bulkOperations);
        console.log(`✅ Precios actualizados. ${result.modifiedCount} productos modificados.`);
        return { message: 'Precios de productos actualizados con éxito.', modifiedCount: result.modifiedCount };

    } catch (error) {
        console.error('Error al actualizar precios de productos:', error);
        throw { statusCode: 500, message: 'Error al actualizar precios', details: error.message };
    }
};

// ─── CRUD manual de productos ─────────────────────────────────────────────────

/**
 * Crear un producto manualmente.
 *
 * Body esperado (JSON o multipart/form-data):
 * {
 *   product_id:     string  (requerido, único)
 *   display_name:   string  (requerido)
 *   base_unit_name: string  (requerido, ej: "unidad", "kg")
 *   category_id:    number  (requerido)
 *   list_price:     number  (requerido — final_price se calcula automáticamente)
 *   category_name:  string  (opcional)
 *   brand:          string  (opcional)
 *   product_type:   string  (opcional)
 *   image:          File    (opcional, campo multipart)
 * }
 *
 * isManual se fuerza a true siempre.
 * final_price se calcula con el margen vigente si no viene en el body.
 */
const createProduct = async (data, imageBuffer = null) => {
    try {
        const profit = await getCurrentProfitMargin();

        // Calcular final_price automáticamente si no viene explícito
        const finalPrice = data.final_price !== undefined
            ? Number(data.final_price)
            : calcFinalPrice(Number(data.list_price), profit);

        const productData = {
            ...data,
            list_price:  Number(data.list_price),
            category_id: Number(data.category_id),
            final_price: finalPrice,
            isManual:    true,  // siempre forzado
        };

        const product = new ScrapedProduct(productData);
        const saved = await product.save();

        // Subir imagen después de guardar (ya tenemos el product_id)
        if (imageBuffer) {
            const imageUrl = await uploadProductImage(imageBuffer, saved.product_id);
            saved.image_url = imageUrl;
            await saved.save();
        }

        return saved;

    } catch (error) {
        if (error.code === 11000) {
            throw { statusCode: 409, message: `Ya existe un producto con product_id "${data.product_id}"` };
        }
        throw { statusCode: 400, message: 'Error al crear producto', details: error.message };
    }
};

/**
 * Actualizar un producto existente por su product_id externo.
 *
 * Campos editables vía body (todos opcionales en update):
 * {
 *   display_name:   string
 *   base_unit_name: string
 *   category_id:    number
 *   category_name:  string
 *   brand:          string
 *   product_type:   string
 *   list_price:     number  → recalcula final_price automáticamente
 *   final_price:    number  → solo se usa si NO viene list_price
 *   image_url:      string  → URL http(s) canonica para la imagen
 *   imageUrl:       string  → alias de entrada, se persiste como image_url
 *   image:          File    → campo multipart, reemplaza la imagen en Cloudinary
 * }
 *
 * Campos inmutables (se descartan aunque vengan en el body):
 *   _id, product_id, isManual, createdAt, updatedAt
 */
const updateProduct = async (productId, data, imageBuffer = null) => {
    // Descartar campos inmutables
    const { _id, product_id, isManual, createdAt, updatedAt, ...safeData } = data;

    normalizeImageUrlFields(safeData, Boolean(imageBuffer));

    // Normalizar tipos numéricos si vienen como string (multipart/form-data los manda así)
    if (safeData.list_price !== undefined) {
        safeData.list_price = Number(safeData.list_price);
        const profit = await getCurrentProfitMargin();
        safeData.final_price = calcFinalPrice(safeData.list_price, profit);
        safeData.priceUpdatedAt = new Date();
    }

    if (safeData.final_price !== undefined) {
        safeData.final_price = Number(safeData.final_price);
    }

    if (safeData.category_id !== undefined) {
        safeData.category_id = Number(safeData.category_id);
    }

    // Subir nueva imagen si viene
    if (imageBuffer) {
        safeData.image_url = await uploadProductImage(imageBuffer, productId);
    }

    try {
        const updated = await ScrapedProduct.findOneAndUpdate(
            { product_id: productId },
            { $set: safeData },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            throw { statusCode: 404, message: `Producto con product_id "${productId}" no encontrado` };
        }

        return updated;

    } catch (error) {
        if (error.statusCode) throw error;
        throw { statusCode: 400, message: 'Error al actualizar producto', details: error.message };
    }
};

/**
 * Eliminar un producto por su product_id.
 * Si era manual y tenía imagen propia en Cloudinary, la elimina también.
 */
const deleteProduct = async (productId) => {
    try {
        const product = await ScrapedProduct.findOne({ product_id: productId }).lean();

        if (!product) {
            throw { statusCode: 404, message: `Producto con product_id "${productId}" no encontrado` };
        }

        await ScrapedProduct.deleteOne({ product_id: productId });

        // Limpiar imagen de Cloudinary solo si era manual (los scrapeados apuntan a URLs externas)
        if (product.isManual && product.image_url) {
            await deleteProductImage(productId);
        }

        return { message: `Producto "${productId}" eliminado correctamente` };

    } catch (error) {
        if (error.statusCode) throw error;
        throw { statusCode: 500, message: 'Error al eliminar producto', details: error.message };
    }
};

module.exports = {
    updateCatalogFromXls,
    runScraper,
    getPaginatedScrapedProducts,
    getScrapedProductById,
    getSections,
    updateProductPrices,
    runSitemapAnalysis,
    runPriceCheck,
    getProductBrands,
    createProduct,
    updateProduct,
    deleteProduct,
};
