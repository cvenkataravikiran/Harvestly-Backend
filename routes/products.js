const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, requireFarmer } = require('../middleware/auth');
const { productValidation } = require('../middleware/validation');

// Public routes
router.get('/', productController.getProducts);
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProduct);

// Protected routes (Farmer only)
router.post('/', authenticateToken, requireFarmer, productValidation, productController.createProduct);
router.put('/:id', authenticateToken, requireFarmer, productController.updateProduct);
router.delete('/:id', authenticateToken, requireFarmer, productController.deleteProduct);
router.get('/farmer/my-products', authenticateToken, requireFarmer, productController.getMyProducts);

module.exports = router; 