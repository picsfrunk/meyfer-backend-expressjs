import { Schema, model } from 'mongoose';

const AdminEmailSchema = new Schema({
    email: { type: String, required: true, unique: true },
    role:  { type: String, enum: ['admin', 'seller'], default: 'admin' },
    active:{ type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export default model('AdminEmail', AdminEmailSchema);