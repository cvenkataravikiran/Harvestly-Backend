const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth');
const { requireSecureAdmin } = require('../middleware/adminSecurity');

// Public routes (with optional auth)
router.get('/', userController.getUsers);

// Protected routes
router.get('/:userId', authenticateToken, userController.getUserById);
router.get('/:userId/stats', authenticateToken, userController.getUserStats);
router.get('/:userId/products', authenticateToken, userController.getUserProducts);
router.get('/:userId/orders', authenticateToken, userController.getUserOrders);
router.get('/:userId/activity', authenticateToken, userController.getUserActivity);

// Admin-only routes (with secure admin access)
router.put('/:userId', authenticateToken, requireSecureAdmin, userController.updateUser);
router.delete('/:userId', authenticateToken, requireSecureAdmin, userController.deleteUser);
router.put('/:userId/role', authenticateToken, requireSecureAdmin, userController.changeUserRole);
router.put('/:userId/verify', authenticateToken, requireSecureAdmin, userController.verifyUser);
router.put('/:userId/toggle-status', authenticateToken, requireSecureAdmin, userController.toggleUserStatus);

module.exports = router; 