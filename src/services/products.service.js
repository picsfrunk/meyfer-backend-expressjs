const axios = require('axios');
const XLSX = require('xlsx');
const { EXCEL_URL, DEFAULT_PROFIT} = require("../utils/constants");
const { processSheetItems } = require('./parser.service');
const Section = require('../models/sections.model');
const Config = require('../models/config.model');

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

        await Section.deleteMany(); // Limpia los datos anteriores
        await Section.insertMany(parsedSections); // Guarda los nuevos

        return { message: 'Catálogo actualizado correctamente' };

    } catch (error) {
        console.error('Error en ProductService al actualizar catálogo:', error);
        throw { statusCode: 500, message: 'Error al actualizar el catálogo', details: error.message };
    }
};