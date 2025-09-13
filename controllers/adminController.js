const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get admin dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Get total counts
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();
    const pendingProducts = await Product.countDocuments({ status: 'Pending' });
    const approvedProducts = await Product.countDocuments({ status: 'Approved' });
    const rejectedProducts = await Product.countDocuments({ status: 'Rejected' });

    // Get user statistics by role
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get order statistics
    const orderStats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get recent orders
    const recentOrders = await Order.find()
      .populate('buyerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get recent products
    const recentProducts = await Product.find()
      .populate('sellerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Get top selling products
    const topProducts = await Product.find({ status: 'Approved' })
      .sort({ sales: -1 })
      .limit(5);

    // Get revenue statistics
    const revenueStats = await Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$totalAmount' },
          orders: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    // Format user stats
    const userStatsFormatted = {
      buyers: 0,
      sellers: 0,
      admins: 0
    };

    userStats.forEach(stat => {
      userStatsFormatted[stat._id + 's'] = stat.count;
    });

    // Format order stats
    const orderStatsFormatted = {
      pending: 0,
      confirmed: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      totalRevenue: 0
    };

    orderStats.forEach(stat => {
      orderStatsFormatted[stat._id.toLowerCase()] = stat.count;
      if (stat._id === 'Delivered') {
        orderStatsFormatted.totalRevenue = stat.totalAmount;
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalProducts,
          totalOrders,
          pendingProducts,
          approvedProducts,
          rejectedProducts
        },
        userStats: userStatsFormatted,
        orderStats: orderStatsFormatted,
        recentOrders,
        recentProducts,
        topProducts,
        revenueStats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message
    });
  }
};

// Get pending products for approval
const getPendingProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const products = await Product.find({ status: 'Pending' })
      .populate('sellerId', 'firstName lastName email phone farmName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({ status: 'Pending' });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending products',
      message: error.message
    });
  }
};

// Approve product
const approveProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isFeatured = false } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    if (product.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        error: 'Product is not pending approval'
      });
    }

    product.status = 'Approved';
    product.approvedAt = new Date();
    product.approvedBy = req.user._id;
    product.isFeatured = isFeatured;

    await product.save();

    res.json({
      success: true,
      data: { product },
      message: 'Product approved successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to approve product',
      message: error.message
    });
  }
};

// Reject product
const rejectProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    if (product.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        error: 'Product is not pending approval'
      });
    }

    product.status = 'Rejected';
    product.rejectionReason = reason;
    product.approvedAt = new Date();
    product.approvedBy = req.user._id;

    await product.save();

    res.json({
      success: true,
      data: { product },
      message: 'Product rejected successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reject product',
      message: error.message
    });
  }
};

// Get all users (admin only)
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
};

// Get user details
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's products if seller
    let products = [];
    if (user.role === 'farmer') {
      products = await Product.find({ sellerId: userId })
        .sort({ createdAt: -1 })
        .limit(10);
    }

    // Get user's orders if buyer
    let orders = [];
    if (user.role === 'buyer') {
      orders = await Order.find({ buyerId: userId })
        .sort({ createdAt: -1 })
        .limit(10);
    }

    res.json({
      success: true,
      data: {
        user,
        products,
        orders
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user details',
      message: error.message
    });
  }
};

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive, isVerified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (isActive !== undefined) {
      user.isActive = isActive;
    }

    if (isVerified !== undefined) {
      user.isVerified = isVerified;
    }

    await user.save();

    res.json({
      success: true,
      data: { user },
      message: 'User status updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user status',
      message: error.message
    });
  }
};

// Get all orders (admin view)
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, paymentStatus } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (status) {
      query.status = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    const orders = await Order.find(query)
      .populate('buyerId', 'firstName lastName email phone')
      .populate('items.productId', 'name price image')
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

// Get system statistics
const getSystemStats = async (req, res) => {
  try {
    // Get monthly statistics
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const monthlyStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lte: endOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' },
          paidOrders: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, 1, 0] }
          },
          paidRevenue: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0] }
          }
        }
      }
    ]);

    // Get product statistics
    const productStats = await Product.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalSales: { $sum: '$sales' },
          totalViews: { $sum: '$views' }
        }
      }
    ]);

    // Get user growth
    const userGrowth = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        monthlyStats: monthlyStats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          paidOrders: 0,
          paidRevenue: 0
        },
        productStats,
        userGrowth
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics',
      message: error.message
    });
  }
};

// Bulk approve products
const bulkApproveProducts = async (req, res) => {
  try {
    const { productIds, isFeatured = false } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs array is required'
      });
    }

    const result = await Product.updateMany(
      { 
        _id: { $in: productIds },
        status: 'Pending'
      },
      {
        status: 'Approved',
        approvedAt: new Date(),
        approvedBy: req.user._id,
        isFeatured
      }
    );

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} products approved successfully`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to bulk approve products',
      message: error.message
    });
  }
};

// Bulk reject products
const bulkRejectProducts = async (req, res) => {
  try {
    const { productIds, reason } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Product IDs array is required'
      });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Rejection reason is required'
      });
    }

    const result = await Product.updateMany(
      { 
        _id: { $in: productIds },
        status: 'Pending'
      },
      {
        status: 'Rejected',
        rejectionReason: reason,
        approvedAt: new Date(),
        approvedBy: req.user._id
      }
    );

    res.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        message: `${result.modifiedCount} products rejected successfully`
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to bulk reject products',
      message: error.message
    });
  }
};

// Get approved products
const getApprovedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const products = await Product.find({ status: 'Approved' })
      .populate('sellerId', 'firstName lastName email phone farmName')
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({ status: 'Approved' });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch approved products',
      message: error.message
    });
  }
};

// Get rejected products
const getRejectedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const products = await Product.find({ status: 'Rejected' })
      .populate('sellerId', 'firstName lastName email phone farmName')
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({ status: 'Rejected' });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalProducts: total,
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rejected products',
      message: error.message
    });
  }
};

// Send notification to farmer
const sendNotification = async (req, res) => {
  try {
    const { farmerId, type, title, message, productId } = req.body;

    if (!farmerId || !type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required notification fields'
      });
    }

    // Create notification object
    const notification = {
      recipientId: farmerId,
      type,
      title,
      message,
      productId,
      createdAt: new Date(),
      isRead: false
    };

    // In a real application, you would save this to a notifications collection
    // For now, we'll just log it and return success
    console.log('Notification sent:', notification);

    // You could also send email/SMS notifications here
    // await sendEmailNotification(farmerId, title, message);
    // await sendSMSNotification(farmerId, message);

    res.json({
      success: true,
      data: { notification },
      message: 'Notification sent successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send notification',
      message: error.message
    });
  }
};

module.exports = {
  getDashboardStats,
  getPendingProducts,
  getApprovedProducts,
  getRejectedProducts,
  approveProduct,
  rejectProduct,
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getAllOrders,
  getSystemStats,
  bulkApproveProducts,
  bulkRejectProducts,
  sendNotification
}; 