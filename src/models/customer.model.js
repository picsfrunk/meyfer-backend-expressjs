const mongoose = require('mongoose');
const DireccionSchema = require('./schemas/direccion.schema');

const CustomerSchema = new mongoose.Schema({
    cliente:      { type: String, required: true, trim: true },
    razonSocial:  { type: String, trim: true, default: '' },
    cuit:         { type: String, trim: true, default: '', index: true },
    contacto:     { type: String, trim: true, default: '' },
    email:        { type: String, trim: true, lowercase: true, default: '' },
    telefono1:    { type: String, trim: true, default: '' },
    direccion:    { type: DireccionSchema, default: () => ({}) },
    horarios:     { type: String, default: '' },
    notas:        { type: String, default: '' },
    customerCode: { type: String, trim: true, default: '' }
}, {
    collection: 'customers',
    timestamps: true
});

// Un cliente se identifica unívocamente por su CUIT (cuando existe)
// o por su email (cuando no hay CUIT). El índice parcial garantiza
// unicidad de email sólo cuando el campo tiene valor real.
CustomerSchema.index(
    { email: 1 },
    { unique: true, sparse: true, partialFilterExpression: { email: { $gt: '' } } }
);
CustomerSchema.index(
    { cuit: 1 },
    { unique: true, sparse: true, partialFilterExpression: { cuit: { $gt: '' } } }
);
CustomerSchema.index(
    { customerCode: 1 },
    { unique: true, sparse: true, partialFilterExpression: { customerCode: { $gt: '' } } }
);

module.exports = mongoose.model('Customer', CustomerSchema);
