const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');

// Get all orders (with filtering and pagination)
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, buyerId, sellerId } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by buyer (for buyers to see their orders)
    if (buyerId) {
      query.buyerId = buyerId;
    }

    // Filter by seller (for sellers to see orders of their products)
    if (sellerId) {
      query['items.sellerId'] = sellerId;
    }

    const orders = await Order.find(query)
      .populate('buyerId', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
};

// Get single order by ID
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate('buyerId', 'firstName lastName email phone address city state zipCode')
      .populate('items.productId', 'name price image sellerName farmName farmLocation');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user has permission to view this order
    if (req.user.role !== 'admin' && order.buyerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order',
      message: error.message
    });
  }
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod = 'razorpay' } = req.body;
    const buyerId = req.user._id;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Order must contain at least one item'
      });
    }

    // Validate and fetch products
    const productIds = items.map(item => item.productId);
    const products = await Product.find({ 
      _id: { $in: productIds },
      status: 'Approved',
      isAvailable: true
    });

    if (products.length !== items.length) {
      return res.status(400).json({
        success: false,
        error: 'Some products are not available or not approved'
      });
    }

    // Calculate totals and validate stock
    let subtotal = 0;
    const orderItems = [];
    const stockUpdates = [];

    for (const item of items) {
      const product = products.find(p => p._id.toString() === item.productId);
      
      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product ${item.productId} not found`
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock for ${product.name}`
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id,
        sellerId: product.sellerId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        total: itemTotal,
        image: product.image,
        sellerName: product.sellerName,
        farmName: product.farmName,
        farmLocation: product.farmLocation
      });

      stockUpdates.push({
        productId: product._id,
        quantity: item.quantity
      });
    }

    // Calculate taxes and shipping
    const tax = subtotal * 0.18; // 18% GST
    const shipping = subtotal > 1000 ? 0 : 100; // Free shipping above ₹1000
    const totalAmount = subtotal + tax + shipping;

    // Create order
    const order = new Order({
      buyerId,
      buyerName: `${req.user.firstName} ${req.user.lastName}`,
      buyerEmail: req.user.email,
      buyerPhone: req.user.phone,
      items: orderItems,
      subtotal,
      tax,
      shipping,
      totalAmount,
      shippingAddress,
      paymentMethod,
      status: 'Pending',
      paymentStatus: 'Pending',
      logistics: [{
        status: 'Order Placed',
        description: 'Your order has been successfully placed',
        timestamp: new Date(),
        location: 'Online'
      }]
    });

    await order.save();

    // Update product stock
    for (const update of stockUpdates) {
      await Product.findByIdAndUpdate(update.productId, {
        $inc: { stock: -update.quantity, sales: update.quantity }
      });
    }

    // Update seller stats
    const sellerIds = [...new Set(orderItems.map(item => item.sellerId))];
    for (const sellerId of sellerIds) {
      const sellerOrders = orderItems.filter(item => item.sellerId.toString() === sellerId.toString());
      const sellerTotal = sellerOrders.reduce((sum, item) => sum + item.total, 0);
      
      await User.findByIdAndUpdate(sellerId, {
        $inc: { 
          totalSales: sellerTotal,
          totalProducts: sellerOrders.length
        }
      });
    }

    res.status(201).json({
      success: true,
      data: { order },
      message: 'Order created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create order',
      message: error.message
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, description, location } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update order status
    order.status = status;
    order.logistics.push({
      status,
      description: description || `Order status updated to ${status}`,
      timestamp: new Date(),
      location: location || 'System'
    });

    // Set delivered date if status is 'Delivered'
    if (status === 'Delivered') {
      order.deliveredAt = new Date();
    }

    await order.save();

    res.json({
      success: true,
      data: { order },
      message: 'Order status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update order status',
      message: error.message
    });
  }
};

// Cancel order
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if order can be cancelled
    if (order.status === 'Delivered' || order.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        error: 'Order cannot be cancelled'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && order.buyerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Update order
    order.status = 'Cancelled';
    order.cancelledAt = new Date();
    order.cancellationReason = reason;
    order.logistics.push({
      status: 'Cancelled',
      description: `Order cancelled: ${reason}`,
      timestamp: new Date(),
      location: 'System'
    });

    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, sales: -item.quantity }
      });
    }

    res.json({
      success: true,
      data: { order },
      message: 'Order cancelled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order',
      message: error.message
    });
  }
};

// Get buyer's orders
const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { buyerId: req.user._id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('items.productId', 'name image price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
};

// Get seller's orders
const getSellerOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    let query = { 'items.sellerId': req.user._id };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('buyerId', 'firstName lastName email phone')
      .populate('items.productId', 'name image price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalOrders: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
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
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' },
          pendingOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] }
          },
          confirmedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] }
          },
          shippedOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Shipped'] }, 1, 0] }
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] }
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        stats: stats[0] || {
          totalOrders: 0,
          totalAmount: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          shippedOrders: 0,
          deliveredOrders: 0,
          cancelledOrders: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order statistics',
      message: error.message
    });
  }
};

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getMyOrders,
  getSellerOrders,
  getOrderStats
}; 