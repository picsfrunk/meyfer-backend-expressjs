const ScrapedProduct = require('../models/products.model');

class CategoryService {
  /**
   * Devuelve todas las categorías con la cantidad de productos en cada una,
   * junto con el total general de productos.
   */
  async getCategoriesWithCounts() {
    // Total de productos
    const totalProducts = await ScrapedProduct.countDocuments();

    // Conteo por categoría
    const categories = await ScrapedProduct.aggregate([
      {
        $group: {
          _id: "$category_name",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          category_name: "$_id",
          product_count: "$count"
        }
      },
      {
        $sort: { category_name: 1 }
      }
    ]);

    return { totalProducts, categories };
  }
}

module.exports = new CategoryService();
