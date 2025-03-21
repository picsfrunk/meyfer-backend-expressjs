require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

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

// Iniciar el servidor
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
