const express = require('express');
const multer = require('multer');
const router = express.Router();
const priceListImportController = require('../controllers/price_list_import.controller');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

router.get('/settings', priceListImportController.getSettings);
router.put('/settings', priceListImportController.saveSettings);
router.post('/import-from-url', priceListImportController.importFromConfiguredUrl);
router.post('/upload', upload.single('file'), priceListImportController.importManualUpload);

module.exports = router;
