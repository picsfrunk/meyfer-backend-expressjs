const cloudinary = require('cloudinary').v2;

// Las credenciales se leen de las variables de entorno:
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Sube un buffer de imagen a Cloudinary.
 * @param {Buffer} buffer      - Buffer del archivo recibido por multer
 * @param {string} productId   - Se usa como public_id para sobreescribir en updates
 * @returns {Promise<string>}  - URL segura de la imagen subida
 */
const uploadProductImage = (buffer, productId) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder:        'meyfer/products',
                public_id:     `product_${productId}`,
                overwrite:     true,   // en updates reemplaza la imagen anterior
                resource_type: 'image',
                transformation: [
                    { width: 800, height: 800, crop: 'limit' }, // máximo 800x800, sin recortar
                    { quality: 'auto', fetch_format: 'auto' }   // optimización automática
                ]
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );

        uploadStream.end(buffer);
    });
};

/**
 * Elimina la imagen de un producto de Cloudinary.
 * Se llama opcionalmente al borrar un producto manual con imagen propia.
 * @param {string} productId
 */
const deleteProductImage = async (productId) => {
    try {
        await cloudinary.uploader.destroy(`meyfer/products/product_${productId}`);
    } catch (error) {
        // No es crítico — solo se loguea, no se propaga
        console.warn(`[Cloudinary] No se pudo eliminar imagen de product_${productId}:`, error.message);
    }
};

module.exports = { uploadProductImage, deleteProductImage };
