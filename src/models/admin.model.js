const mongoose = require('mongoose');

const AdminEmailSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    role:  { type: String, enum: ['admin', 'seller'], default: 'admin' },
    active:{ type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdminEmail', AdminEmailSchema);
