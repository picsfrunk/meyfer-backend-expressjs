const ProductsService = require('../services/products.service');
const mongoose = require('mongoose');

// Modelo dinámico para la colección scraped-products
const ScrapedProduct = mongoose.model(
  'ScrapedProduct',
  new mongoose.Schema({}, { strict: false, collection: 'scraped-products' })
);

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

// Nuevo endpoint paginado para productos scrapeados
const getScrapedProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      ScrapedProduct.find().skip(skip).limit(limit),
      ScrapedProduct.countDocuments()
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      products
    });
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
