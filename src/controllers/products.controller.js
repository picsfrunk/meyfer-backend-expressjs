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
  console.log(params);
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

module.exports = {
  getParsedProducts,
  updateParsedProducts,
  triggerScraper,
};