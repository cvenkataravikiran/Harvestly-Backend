const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');

// Get all users (with filtering and pagination)
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search, isActive, isVerified } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    
    if (role) {
      query.role = role;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (isVerified !== undefined) {
      query.isVerified = isVerified === 'true';
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
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

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      message: error.message
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.email; // Email should be updated through a separate process
    delete updateData.role; // Role should be managed by admin

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user },
      message: 'User updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user',
      message: error.message
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has active orders or products
    const activeOrders = await Order.findOne({ buyerId: userId, status: { $nin: ['Delivered', 'Cancelled'] } });
    const activeProducts = await Product.findOne({ sellerId: userId, status: 'Approved' });

    if (activeOrders || activeProducts) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete user with active orders or products'
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      message: error.message
    });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let stats = {};

    if (user.role === 'farmer') {
      // Get farmer statistics
      const productStats = await Product.aggregate([
        { $match: { sellerId: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalSales: { $sum: '$sales' },
            totalViews: { $sum: '$views' }
          }
        }
      ]);

      const orderStats = await Order.aggregate([
        { $match: { 'items.sellerId': user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      stats = {
        products: productStats,
        orders: orderStats,
        totalProducts: user.totalProducts,
        totalSales: user.totalSales,
        rating: user.rating,
        totalReviews: user.totalReviews
      };
    } else if (user.role === 'buyer') {
      // Get buyer statistics
      const orderStats = await Order.aggregate([
        { $match: { buyerId: user._id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      stats = {
        orders: orderStats,
        totalOrders: orderStats.reduce((sum, stat) => sum + stat.count, 0),
        totalSpent: orderStats.reduce((sum, stat) => sum + stat.totalAmount, 0)
      };
    }

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user statistics',
      message: error.message
    });
  }
};

    // Get user's products (for farmers)
const getUserProducts = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.role !== 'farmer') {
      return res.status(400).json({
        success: false,
        error: 'User is not a farmer'
      });
    }

    let query = { sellerId: userId };
    if (status) {
      query.status = status;
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

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
      error: 'Failed to fetch user products',
      message: error.message
    });
  }
};

// Get user's orders (for buyers)
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (user.role !== 'buyer') {
      return res.status(400).json({
        success: false,
        error: 'User is not a buyer'
      });
    }

    let query = { buyerId: userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
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
      error: 'Failed to fetch user orders',
      message: error.message
    });
  }
};

// Change user role (admin only)
const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['buyer', 'farmer', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid role'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if user has active orders or products that might conflict with role change
    if (role === 'buyer' && user.role === 'farmer') {
      const activeProducts = await Product.findOne({ sellerId: userId, status: 'Approved' });
      if (activeProducts) {
        return res.status(400).json({
          success: false,
          error: 'Cannot change role: user has active products'
        });
      }
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      data: { user },
      message: 'User role changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to change user role',
      message: error.message
    });
  }
};

// Verify user (admin only)
const verifyUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isVerified } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isVerified = isVerified;
    await user.save();

    res.json({
      success: true,
      data: { user },
      message: `User ${isVerified ? 'verified' : 'unverified'} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify user',
      message: error.message
    });
  }
};

// Activate/Deactivate user (admin only)
const toggleUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      data: { user },
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to toggle user status',
      message: error.message
    });
  }
};

// Get user activity log
const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    let activities = [];

    if (user.role === 'farmer') {
      // Get product activities
      const products = await Product.find({ sellerId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      activities = products.map(product => ({
        type: 'product',
        action: product.status === 'Approved' ? 'Product Approved' : 
                product.status === 'Rejected' ? 'Product Rejected' : 'Product Created',
        item: product,
        timestamp: product.updatedAt
      }));
    } else if (user.role === 'buyer') {
      // Get order activities
      const orders = await Order.find({ buyerId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      activities = orders.map(order => ({
        type: 'order',
        action: `Order ${order.status}`,
        item: order,
        timestamp: order.updatedAt
      }));
    }

    res.json({
      success: true,
      data: { activities }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user activity',
      message: error.message
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
  getUserProducts,
  getUserOrders,
  changeUserRole,
  verifyUser,
  toggleUserStatus,
  getUserActivity
}; 