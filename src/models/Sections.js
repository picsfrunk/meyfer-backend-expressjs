const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  description: String,
  price: Number,
  code: String,
  barcode: String,
});

const ProductSchema = new mongoose.Schema({
  name: String,
  items: [ItemSchema],
});

const SectionSchema = new mongoose.Schema({
  title: String,
  image: String,
  products: [ProductSchema],
});

module.exports = mongoose.model('Section', SectionSchema);