const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken, requireBuyer } = require('../middleware/auth');

// Payment routes
router.post('/create-order', authenticateToken, requireBuyer, paymentController.createPaymentOrder);
router.post('/verify', authenticateToken, requireBuyer, paymentController.verifyPayment);
router.get('/details/:orderId', authenticateToken, requireBuyer, paymentController.getPaymentDetails);
router.post('/refund/:orderId', authenticateToken, paymentController.refundPayment);
router.get('/stats', authenticateToken, paymentController.getPaymentStats);

// Webhook route (no auth required)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router; 