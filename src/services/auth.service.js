const jwt = require('jsonwebtoken');
const { ADMIN_USER, ADMIN_PASS, JWT_SECRET, JWT_EXPIRES_IN = '1h' } = process.env;

exports.authenticate = (username, password) => {
    if (!username || !password) {
        throw new Error('Usuario y contraseña requeridos');
    }

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
        throw new Error('Credenciales inválidas');
    }

    const token = jwt.sign(
        { role: 'admin', username },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    return token;
};