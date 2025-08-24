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

const getScrapedProducts = async (req, res, next) => {
    try {
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

module.exports = {
  getParsedProducts,
  updateParsedProducts,
  triggerScraper,
  getScrapedProducts,
};
