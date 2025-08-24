const categoryService = require('../services/category.service');
const sleep = require('../utils/sleep');

exports.getCategories = async (req, res) => {
  try {
    await sleep(4000)
    const categories = await categoryService.getCategoriesWithCounts();
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
};
