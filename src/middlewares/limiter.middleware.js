const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 1000, // 1 segundo
    max: 5,         // máximo 5 requests por segundo
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, inténtelo de nuevo en un momento.' },
});

module.exports = { limiter };