const ProductsService = require('../services/products.service');
const sleep = require('../utils/sleep');

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

const getScrapedProducts = async (req, res, next) => {
    try {
        await sleep(3000)

        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const categoryId = parseInt(req.query.category_id);
        const searchKeyword = req.query.search;

        const result = await ProductsService.getPaginatedScrapedProducts(
            page,
            limit,
            categoryId,
            searchKeyword);

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Error fetching scraped products', details: err.message });
    }
};

const getScrapedProductById  = async (req, res, next) => {
    try {
        const id = req.params.id;

        const product = await ProductsService.getScrapedProductById(parseInt(id));

        if (!product) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ error: 'Error al buscar el producto', details: error.message });
    }
}

module.exports = {
    getParsedProducts,
    updateParsedProducts,
    triggerScraper,
    getScrapedProducts,
    getScrapedProductById
};
