const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, requireBuyer, requireFarmer } = require('../middleware/auth');

// Public routes (with optional auth for guest browsing)
router.get('/', orderController.getOrders);

// Protected routes
router.get('/my-orders', authenticateToken, requireBuyer, orderController.getMyOrders);
router.get('/farmer-orders', authenticateToken, requireFarmer, orderController.getSellerOrders);
router.get('/stats', authenticateToken, orderController.getOrderStats);
router.get('/:id', authenticateToken, orderController.getOrder);

// Order management
router.post('/', authenticateToken, requireBuyer, orderController.createOrder);
router.put('/:id/status', authenticateToken, orderController.updateOrderStatus);
router.put('/:id/cancel', authenticateToken, orderController.cancelOrder);

module.exports = router; 