const mongoose = require('mongoose');

const DireccionSchema = new mongoose.Schema({
    calle:       { type: String, default: '' },
    numero:      { type: String, default: '' },
    piso:        { type: String, default: '' },
    timbre:      { type: String, default: '' },
    entreCalles: { type: String, default: '' },
    localidad:   { type: String, default: '' },
    partido:     { type: String, default: '' }
}, { _id: false });

module.exports = DireccionSchema;
