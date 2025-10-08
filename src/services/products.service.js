const axios = require('axios');
const XLSX = require('xlsx');
const { EXCEL_URL, DEFAULT_PROFIT} = require("../utils/constants");
const { processSheetItems } = require('./parser.service');
const Section = require('../models/sections.model');
const Config = require('../models/config.model');
const ScrapedProduct = require('../models/products.model');

const getSections = async () => {
    try {
        return await Section.find();
    } catch (error) {
        console.error('Error en ProductService al obtener secciones:', error);
        throw { statusCode: 500, message: 'Error al consultar la base de datos', details: error.message };
    }
};

const updateCatalogFromXls = async () => {
    try {
        const response = await axios.get(EXCEL_URL, { responseType: 'arraybuffer' });

        const workbook = XLSX.read(response.data, { type: 'buffer' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const sheetItems = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 15 });

        const configProfit = await Config.findOne({ key: 'profitMargin' });
        const profit = configProfit?.value ?? DEFAULT_PROFIT;

        const parsedSections = processSheetItems(sheetItems, profit);

        await Section.deleteMany();
        await Section.insertMany(parsedSections);

        await Config.findOneAndUpdate(
            { key: 'last_update' },
            { value: new Date() },
            { upsert: true, new: true }
        );

        return { message: 'Catálogo actualizado correctamente' };

    } catch (error) {
        console.error('Error en ProductService al actualizar catálogo:', error);
        throw { statusCode: 500, message: 'Error al actualizar el catálogo', details: error.message };
    }
};

const runScraper = async (scraperType, params = {}) => {
    try {
        let scraperUrl;
        let payload = { ...params };

        payload.webhookUrl = process.env.WEBHOOK_URL;

        switch (scraperType) {
            case 'categoryScraper':
                scraperUrl = process.env.CATEGORY_SCRAPER_URL;
                break;
            case 'sitemapScraper':
                scraperUrl = process.env.SITEMAP_SCRAPER_URL;
                break;
            default:
                throw { statusCode: 400, message: 'Tipo de scraper inválido' };
        }

        const response = await axios.post(scraperUrl, payload);
        return response.data;
    } catch (error) {
        throw {
            statusCode: error.response?.status || 500,
            message: error.message,
            details: error.response?.data || null
        };
    }
};

const getPaginatedScrapedProducts = async (page = 1,
                                             limit = 20,
                                             categoryId = null,
                                             searchKeyword = null) => {
    const skip = (page - 1) * limit;

    const filter = {};
    if (categoryId) {
        filter.category_id = categoryId;
    }

    if (searchKeyword) {
        // Usa el operador $text con la palabra clave
        filter.$text = { $search: searchKeyword };
    }

    const projection = searchKeyword ? { score: { $meta: "textScore" } } : {};
    const sort = searchKeyword ? { score: { $meta: "textScore" } } : { _id: 1 }; // O el orden que prefieras



    const [products, total] = await Promise.all([
        ScrapedProduct.find(filter, projection).skip(skip).limit(limit).sort(sort),
        ScrapedProduct.countDocuments(filter)
    ]);

    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        products
    };
};

const getScrapedProductById = async (id) => {
    try {
        return await ScrapedProduct.findOne({product_id: id}).exec();
    } catch (error) {
        throw new Error(`Error al obtener el producto con product_id ${id}: ${error.message}`);
    }
};

const updateProductPrices = async () => {
    try {
        const configProfit = await Config.findOne({ key: 'profitMargin' });
        const profit = configProfit?.value ?? DEFAULT_PROFIT;

        const profitMarginDecimal = profit / 100;

        const productsToUpdate = await ScrapedProduct.find();

        if (productsToUpdate.length === 0) {
            return { message: 'No hay productos para actualizar.' };
        }

        const bulkOperations = productsToUpdate.map(product => {
            const oldPrice = product.list_price;
            const newPrice = oldPrice * (1 + profitMarginDecimal);

            return {
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { final_price: newPrice } }
                }
            };
        });

        const result = await ScrapedProduct.bulkWrite(bulkOperations);

        console.log(`✅ Precios actualizados. ${result.modifiedCount} productos modificados.`);
        return { message: 'Precios de productos actualizados con éxito.', modifiedCount: result.modifiedCount };

    } catch (error) {
        console.error('Error al actualizar precios de productos:', error);
        throw { statusCode: 500, message: 'Error al actualizar precios', details: error.message };
    }
};

module.exports = {
    updateCatalogFromXls,
    runScraper,
    getPaginatedScrapedProducts,
    getScrapedProductById,
    getSections,
    updateProductPrices,
}