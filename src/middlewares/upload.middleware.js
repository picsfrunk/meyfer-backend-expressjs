const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;
const PRICE_LIST_MAX_SIZE_MB = 5;

const storage = multer.memoryStorage(); // buffer en RAM, nunca toca el disco

const fileFilter = (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Formato no permitido. Solo se aceptan: ${ALLOWED_MIME_TYPES.join(', ')}`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

const uploadPriceList = multer({
    storage,
    limits: { fileSize: PRICE_LIST_MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = { upload, uploadPriceList };
