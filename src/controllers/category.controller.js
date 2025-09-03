const categoryService = require('../services/category.service');

exports.getCategories = async (req, res) => {
  try {
    const categories = await categoryService.getCategoriesWithCounts();
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
};
