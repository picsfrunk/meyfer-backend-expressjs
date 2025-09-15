const authService = require('../services/auth.service');

exports.login = (req, res, next) => {
    try {
        const { username, password } = req.body;
        const token = authService.authenticate(username, password);

        res.json({ token });
    } catch (error) {
        next(error);
    }
};