const express = require('express');
const router = express.Router();
const configController = require('../controllers/config.controller');

router.get('/profit', configController.getProfitMargin);
router.put('/profit', configController.setProfitMargin);
router.get('/last-update', configController.getLastUpdateDate);

module.exports = router;
