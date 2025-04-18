const axios = require('axios');
const XLSX = require('xlsx');
const { processSheetItems } = require('../services/parser.service');

const getParsedProducts = async (req, res) => {
  try {
    const url = 'https://rhcomercial.com.ar/lista/listadepreciosrh.xls';
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetItems = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 15 });

    const parsedSections = processSheetItems(sheetItems);
    res.json(parsedSections);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al procesar el archivo', details: error.message });
  }
};

module.exports = { getParsedProducts };