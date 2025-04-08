require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Permitir CORS
app.use(express.json());

// Ruta para descargar el archivo XLS y enviarlo al frontend
app.get('/fetch-xls', async (req, res) => {
    try {
        const url = 'https://rhcomercial.com.ar/lista/listadepreciosrh.xls';
        const response = await axios.get(url, { responseType: 'arraybuffer' });

        // Configurar cabeceras para enviar el archivo correctamente
        res.setHeader('Content-Disposition', 'attachment; filename="listadepreciosrh.xls"');
        res.setHeader('Content-Type', 'application/vnd.ms-excel');

        res.send(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Error al descargar el archivo', details: error.message });
    }
});

// Ruta para importar datos desde el archivo XLS y convertirlo a JSON   
app.get('/api/products/imported-from-xls', async (req, res) => {
  try {
    const url = 'https://rhcomercial.com.ar/lista/listadepreciosrh.xls';
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    const workbook = XLSX.read(response.data, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Parámetro range: 15 salta las primeras 15 filas
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, range: 15 });

    res.json(jsonData);
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar el archivo', details: error.message });
  }
});


// Iniciar el servidor
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
