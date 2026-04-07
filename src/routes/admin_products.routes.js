const express = require('express');
const router = express.Router();
const { upload } = require('../middlewares/upload.middleware');
const {
    createProduct,
    updateProduct,
    deleteProduct,
} = require('../controllers/products.controller');

// El middleware upload.single('image') parsea multipart/form-data.
// Si no viene imagen, req.file es undefined — el controller lo maneja.

// POST /admin/products
router.post('/', upload.single('image'), createProduct);

// PUT /admin/products/:productId
router.put('/:productId', upload.single('image'), updateProduct);

// DELETE /admin/products/:productId
router.delete('/:productId', deleteProduct);

module.exports = router;
