const axios = require('axios');
const XLSX = require('xlsx');
const { EXCEL_URL, DEFAULT_PROFIT} = require("../utils/constants");
const { processSheetItems } = require('./parser.service');
const Section = require('../models/sections.model');
const Config = require('../models/config.model');
const ScrapedProduct = require('../models/products.model');

exports.getSections = async () => {
    try {
        return await Section.find();
    } catch (error) {
        console.error('Error en ProductService al obtener secciones:', error);
        throw { statusCode: 500, message: 'Error al consultar la base de datos', details: error.message };
    }
};

exports.updateCatalogFromXls = async () => {
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
exports.runScraper = async (scraperType, params = {}) => {
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

exports.getPaginatedScrapedProducts = async (page = 1, limit = 20, categoryId = null) => {
    const skip = (page - 1) * limit;

    const filter = {};
    if (categoryId) {
        filter.category_id = categoryId;
    }

    const [products, total] = await Promise.all([
        ScrapedProduct.find(filter).skip(skip).limit(limit),
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