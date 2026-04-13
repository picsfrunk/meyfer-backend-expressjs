const express = require('express');
const router = express.Router();
const CustomersController = require('../controllers/customers.controller');

// GET  /admin/customers
router.get('/', CustomersController.getAllCustomers);

// GET  /admin/customers/:id
router.get('/:id', CustomersController.getCustomerById);

// POST /admin/customers
router.post('/', CustomersController.createCustomer);

// PUT  /admin/customers/:id
router.put('/:id', CustomersController.updateCustomer);

// POST /admin/customers/:id/regenerate-code
router.post('/:id/regenerate-code', CustomersController.regenerateCode);

// DELETE /admin/customers/:id
router.delete('/:id', CustomersController.deleteCustomer);

module.exports = router;
