const Razorpay = require('razorpay');
const Order = require('../models/Order');
const crypto = require('crypto');
const { getRazorpayConfig, isConfigured } = require('../config/razorpay');

// Initialize Razorpay with fallback for missing keys
let razorpay = null;
try {
  const config = getRazorpayConfig();
  if (config) {
    razorpay = new Razorpay(config);
    console.log('✅ Razorpay initialized successfully');
  }
} catch (error) {
  console.error('❌ Failed to initialize Razorpay:', error.message);
}

// Helper function to check if Razorpay is available
const isRazorpayAvailable = () => {
  return razorpay !== null && isConfigured();
};

// Create Razorpay order
const createPaymentOrder = async (req, res) => {
  try {
    const { orderId, amount, currency = 'INR' } = req.body;

    if (!orderId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Order ID and amount are required'
      });
    }

    // Check if Razorpay is available
    if (!isRazorpayAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is currently unavailable. Please contact support.'
      });
    }

    // Verify order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    if (order.paymentStatus === 'Paid') {
      return res.status(400).json({
        success: false,
        error: 'Order is already paid'
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `order_${orderId}`,
      notes: {
        orderId: orderId,
        buyerId: req.user._id.toString(),
        buyerName: req.user.firstName + ' ' + req.user.lastName
      }
    });

    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      success: true,
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        receipt: razorpayOrder.receipt,
        key: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (error) {
    console.error('Payment order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment order',
      message: error.message
    });
  }
};

// Verify payment signature
const verifyPayment = async (req, res) => {
  try {
    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      orderId 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment verification parameters'
      });
    }

    // Check if Razorpay is available
    if (!isRazorpayAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is currently unavailable. Please contact support.'
      });
    }

    // Verify order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Verify signature
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest('hex');

    if (signature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature'
      });
    }

    // Update order payment status
    order.paymentStatus = 'Paid';
    order.paymentId = razorpay_payment_id;
    order.razorpayPaymentId = razorpay_payment_id;
    order.status = 'Confirmed';
    order.logistics.push({
      status: 'Payment Confirmed',
      description: 'Payment has been successfully processed',
      timestamp: new Date(),
      location: 'Online'
    });

    await order.save();

    res.json({
      success: true,
      data: {
        orderId: order._id,
        paymentId: razorpay_payment_id,
        status: 'Paid',
        message: 'Payment verified successfully'
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      message: error.message
    });
  }
};

// Get payment details
const getPaymentDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order._id,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId: order.razorpayPaymentId,
        totalAmount: order.totalAmount,
        currency: 'INR'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment details',
      message: error.message
    });
  }
};

// Refund payment
const refundPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Customer request' } = req.body;

    // Check if Razorpay is available
    if (!isRazorpayAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Payment service is currently unavailable. Please contact support.'
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.paymentStatus !== 'Paid') {
      return res.status(400).json({
        success: false,
        error: 'Order is not paid'
      });
    }

    if (!order.razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        error: 'No payment ID found for refund'
      });
    }

    // Create refund through Razorpay
    const refund = await razorpay.payments.refund(order.razorpayPaymentId, {
      amount: Math.round(order.totalAmount * 100), // Convert to paise
      speed: 'normal',
      notes: {
        reason: reason,
        orderId: orderId
      }
    });

    // Update order status
    order.paymentStatus = 'Refunded';
    order.status = 'Cancelled';
    order.logistics.push({
      status: 'Payment Refunded',
      description: `Payment refunded: ${reason}`,
      timestamp: new Date(),
      location: 'Online'
    });

    await order.save();

    res.json({
      success: true,
      data: {
        refundId: refund.id,
        orderId: order._id,
        amount: refund.amount,
        status: refund.status,
        message: 'Payment refunded successfully'
      }
    });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process refund',
      message: error.message
    });
  }
};

// Get payment statistics
const getPaymentStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let query = {};
    if (userRole === 'buyer') {
      query.buyerId = userId;
    } else if (userRole === 'farmer') {
      query['items.sellerId'] = userId;
    }

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    const paymentStats = {
      total: 0,
      paid: 0,
      pending: 0,
      failed: 0,
      refunded: 0,
      totalAmount: 0,
      paidAmount: 0
    };

    stats.forEach(stat => {
      paymentStats.total += stat.count;
      paymentStats.totalAmount += stat.totalAmount;
      
      switch (stat._id) {
        case 'Paid':
          paymentStats.paid = stat.count;
          paymentStats.paidAmount = stat.totalAmount;
          break;
        case 'Pending':
          paymentStats.pending = stat.count;
          break;
        case 'Failed':
          paymentStats.failed = stat.count;
          break;
        case 'Refunded':
          paymentStats.refunded = stat.count;
          break;
      }
    });

    res.json({
      success: true,
      data: { paymentStats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment statistics',
      message: error.message
    });
  }
};

// Webhook handler for Razorpay events
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing signature'
      });
    }

    // Verify webhook signature
    const text = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(text)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    const event = req.body;

    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'refund.processed':
        await handleRefundProcessed(event.payload.refund.entity);
        break;
      default:
        console.log(`Unhandled webhook event: ${event.event}`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
};

// Handle payment captured event
const handlePaymentCaptured = async (payment) => {
  try {
    const order = await Order.findOne({ razorpayOrderId: payment.order_id });
    if (order) {
      order.paymentStatus = 'Paid';
      order.paymentId = payment.id;
      order.razorpayPaymentId = payment.id;
      order.status = 'Confirmed';
      order.logistics.push({
        status: 'Payment Confirmed',
        description: 'Payment has been successfully processed',
        timestamp: new Date(),
        location: 'Online'
      });
      await order.save();
    }
  } catch (error) {
    console.error('Payment captured handler error:', error);
  }
};

// Handle payment failed event
const handlePaymentFailed = async (payment) => {
  try {
    const order = await Order.findOne({ razorpayOrderId: payment.order_id });
    if (order) {
      order.paymentStatus = 'Failed';
      order.logistics.push({
        status: 'Payment Failed',
        description: `Payment failed: ${payment.error_description || 'Unknown error'}`,
        timestamp: new Date(),
        location: 'Online'
      });
      await order.save();
    }
  } catch (error) {
    console.error('Payment failed handler error:', error);
  }
};

// Handle refund processed event
const handleRefundProcessed = async (refund) => {
  try {
    const order = await Order.findOne({ razorpayPaymentId: refund.payment_id });
    if (order) {
      order.paymentStatus = 'Refunded';
      order.status = 'Cancelled';
      order.logistics.push({
        status: 'Payment Refunded',
        description: `Payment refunded: ${refund.notes?.reason || 'Refund processed'}`,
        timestamp: new Date(),
        location: 'Online'
      });
      await order.save();
    }
  } catch (error) {
    console.error('Refund processed handler error:', error);
  }
};

module.exports = {
  createPaymentOrder,
  verifyPayment,
  getPaymentDetails,
  refundPayment,
  getPaymentStats,
  handleWebhook
}; 