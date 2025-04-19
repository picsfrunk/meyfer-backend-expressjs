const axios = require('axios');
const XLSX = require('xlsx');
const { processSheetItems } = require('../services/parser.service');
const Section = require('../models/Sections');

// GET: obtener las secciones desde MongoDB
const getSectionsFromDb = async (req, res) => {
  try {
    const sections = await Section.find();
    res.json(sections);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar MongoDB', details: error.message });
  }
};

// POST: actualizar MongoDB con nuevos datos desde el XLS
const updateSectionsFromXls = async (req, res) => {
  try {
    const url = 'https://rhcomercial.com.ar/lista/listadepreciosrh.xls';
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetItems = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 15 });

    const parsedSections = processSheetItems(sheetItems);

    await Section.deleteMany(); // Limpia los datos anteriores
    await Section.insertMany(parsedSections); // Guarda los nuevos

    res.status(200).json({ message: 'Catálogo actualizado correctamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar catálogo', details: error.message });
  }
};

module.exports = {
  getParsedProducts: getSectionsFromDb,
  updateParsedProducts: updateSectionsFromXls,
};
