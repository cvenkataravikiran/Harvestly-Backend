const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const jwtSecret = process.env.JWT_SECRET || 'harvestly-super-secret-jwt-key-2024-production-ready';
    const decoded = jwt.verify(token, jwtSecret);
    
    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Middleware to check if user is seller (for backward compatibility)
const requireSeller = (req, res, next) => {
  if (req.user.role !== 'farmer' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Seller access required'
    });
  }
  next();
};

// Middleware to check if user is farmer
const requireFarmer = (req, res, next) => {
  if (req.user.role !== 'farmer' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Farmer access required'
    });
  }
  next();
};

// Middleware to check if user is buyer
const requireBuyer = (req, res, next) => {
  if (req.user.role !== 'buyer' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Buyer access required'
    });
  }
  next();
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const jwtSecret = process.env.JWT_SECRET || 'harvestly-super-secret-jwt-key-2024-production-ready';
      const decoded = jwt.verify(token, jwtSecret);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSeller,
  requireFarmer,
  requireBuyer,
  optionalAuth
}; 