const jwt = require('jsonwebtoken');
const { JWT_SECRET } = process.env;

function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ error: 'Token requerido' });
    }

    const token = authHeader.split(' ')[1]; // formato: Bearer <token>
    if (!token) {
        return res.status(401).json({ error: 'Token inválido' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'No autorizado' });
        }

        req.user = decoded; // guarda info del admin en la request
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
}

module.exports = { authenticateAdmin };
