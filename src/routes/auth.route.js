const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const {
    ADMIN_USER,
    ADMIN_PASS,
    JWT_SECRET,
    JWT_EXPIRES_IN = '1h'
} = process.env;

router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
        { role: 'admin', username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({ token });
});

module.exports = router;
