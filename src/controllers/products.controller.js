const ProductsService = require('../services/products.service');

const getParsedProducts = async (req, res) => {
    try {
        const sections = await ProductsService.getSections();
        res.json(sections);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message || 'Error del servidor', details: error.details });
    }
};

const updateParsedProducts = async (req, res) => {
    try {
        const result = await ProductsService.updateCatalogFromXls();
        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(error.statusCode || 500).json({ error: error.message || 'Error al actualizar catálogo', details: error.details });
    }
};

const triggerScraper = async (req, res) => {
    const { scraperType, ...params } = req.body;
    try {
        const result = await ProductsService.runScraper(scraperType, params);
        res.status(202).json({ message: 'Scraper iniciado', scraperType, result });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al ejecutar scraper',
            details: error.details
        });
    }
};

const analyzeSitemap = async (req, res) => {
    const { ...params } = req.body;
    try {
        const result = await ProductsService.runSitemapAnalysis(params);
        res.status(202).json({ message: 'Analisis iniciado', result });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al ejecutar analisis',
            details: error.details
        });
    }
};

const checkPrices = async (req, res) => {
    try {
        const result = await ProductsService.runPriceCheck();
        res.status(202).json({ message: 'Verificación de precios iniciada', result });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al ejecutar price check',
            details: error.details
        });
    }
};

const getScrapedProducts = async (req, res) => {
    try {
        const page        = parseInt(req.query.page, 10) || 1;
        const limit       = parseInt(req.query.limit, 10) || 20;
        const categoryId  = parseInt(req.query.category_id);
        const searchKeyword = req.query.search;
        const brand       = req.query.brand;

        const result = await ProductsService.getPaginatedScrapedProducts(
            page, limit, categoryId, searchKeyword, brand
        );

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching scraped products', details: err.message });
    }
};

const getScrapedProductById = async (req, res) => {
    try {
        const product = await ProductsService.getScrapedProductById(parseInt(req.params.id));

        if (!product) {
            return res.status(404).json({ message: 'Producto no encontrado' });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar el producto', details: error.message });
    }
};

const getProductBrands = async (req, res) => {
    try {
        const brands = await ProductsService.getProductBrands();
        res.status(200).json({ success: true, count: brands.length, data: brands });
    } catch (error) {
        console.error('Error en getProductBrands:', error);
        res.status(500).json({ success: false, message: 'Error al obtener las marcas', error: error.message });
    }
};

// ─── CRUD manual de productos ─────────────────────────────────────────────────

/**
 * POST /admin/products
 * Content-Type: multipart/form-data
 *
 * Campos de texto: product_id, display_name, base_unit_name, category_id,
 *                  list_price, category_name, brand, product_type
 * Archivo:         image (opcional)
 */
const createProduct = async (req, res) => {
    try {
        const imageBuffer = req.file?.buffer ?? null;
        const product = await ProductsService.createProduct(req.body, imageBuffer);
        res.status(201).json({ message: 'Producto creado', product });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al crear producto',
            details: error.details
        });
    }
};

/**
 * PUT /admin/products/:productId
 * Content-Type: multipart/form-data
 *
 * Todos los campos son opcionales en update.
 * Si se manda list_price, se recalcula final_price automáticamente.
 * Si se manda el archivo image, se reemplaza la imagen en Cloudinary.
 */
const updateProduct = async (req, res) => {
    try {
        const imageBuffer = req.file?.buffer ?? null;
        const product = await ProductsService.updateProduct(req.params.productId, req.body, imageBuffer);
        res.status(200).json({ message: 'Producto actualizado', product });
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al actualizar producto',
            details: error.details
        });
    }
};

/**
 * DELETE /admin/products/:productId
 * Elimina el producto y, si era manual, también su imagen en Cloudinary.
 */
const deleteProduct = async (req, res) => {
    try {
        const result = await ProductsService.deleteProduct(req.params.productId);
        res.status(200).json(result);
    } catch (error) {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Error al eliminar producto',
            details: error.details
        });
    }
};

module.exports = {
    getParsedProducts,
    updateParsedProducts,
    triggerScraper,
    getScrapedProducts,
    getScrapedProductById,
    analyzeSitemap,
    checkPrices,
    getProductBrands,
    createProduct,
    updateProduct,
    deleteProduct,
};
