const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');
const { requireSecureAdmin, logAdminAction } = require('../middleware/adminSecurity');

// All admin routes require authentication and secure admin role
router.use(authenticateToken, requireSecureAdmin, logAdminAction);

// Dashboard and statistics
router.get('/dashboard', adminController.getDashboardStats);
router.get('/stats', adminController.getSystemStats);

// Product management
router.get('/products/pending', adminController.getPendingProducts);
router.get('/products/approved', adminController.getApprovedProducts);
router.get('/products/rejected', adminController.getRejectedProducts);
router.put('/products/:productId/approve', adminController.approveProduct);
router.put('/products/:productId/reject', adminController.rejectProduct);
router.post('/products/bulk-approve', adminController.bulkApproveProducts);
router.post('/products/bulk-reject', adminController.bulkRejectProducts);

// Notification management
router.post('/notifications/send', adminController.sendNotification);

// User management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', adminController.getUserDetails);
router.put('/users/:userId/status', adminController.updateUserStatus);

// Order management
router.get('/orders', adminController.getAllOrders);

module.exports = router; 