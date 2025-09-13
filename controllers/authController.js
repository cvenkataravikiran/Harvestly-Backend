const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateAdminCreation } = require('../config/adminWhitelist');

// Generate JWT Token
const generateToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET || 'harvestly-super-secret-jwt-key-2024-production-ready';
  return jwt.sign(
    { userId },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      role,
      address,
      city,
      state,
      zipCode,
      landmark,
      farmName,
      farmLocation,
      farmAddress,
      farmCity,
      farmState,
      farmZipCode,
      farmPhone
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user data based on role
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      role
    };

    // Add role-specific fields
    if (role === 'buyer') {
      userData.address = address;
      userData.city = city;
      userData.state = state;
      userData.zipCode = zipCode;
      userData.landmark = landmark;
    } else if (role === 'farmer') {
      userData.farmName = farmName;
      userData.farmLocation = farmLocation;
      userData.farmAddress = farmAddress;
      userData.farmCity = farmCity;
      userData.farmState = farmState;
      userData.farmZipCode = farmZipCode;
      userData.farmPhone = farmPhone;
    } else if (role === 'admin') {
      // Validate admin creation
      const adminValidation = validateAdminCreation(email, req.body.adminCode);
      if (!adminValidation.isValid) {
        return res.status(403).json({
          success: false,
          message: adminValidation.message
        });
      }
    }

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
};

// @desc    Register admin user (secure)
// @route   POST /api/auth/admin/register
// @access  Public (with admin code)
const registerAdmin = async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      adminCode
    } = req.body;

    // Validate admin creation
    const adminValidation = validateAdminCreation(email, adminCode);
    if (!adminValidation.isValid) {
      return res.status(403).json({
        success: false,
        message: adminValidation.message
      });
    }

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create admin user
    const userData = {
      email,
      password,
      firstName,
      lastName,
      phone,
      role: 'admin',
      isVerified: true,
      isActive: true
    };

    // Create user
    const user = await User.create(userData);

    // Generate token
    const token = generateToken(user._id);

    // Log admin creation
    console.log(`🔐 New admin created: ${email} - ${new Date().toISOString()}`);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        user: user.getPublicProfile(),
        token
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin registration failed',
      error: error.message
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      address,
      city,
      state,
      zipCode,
      landmark,
      farmName,
      farmLocation,
      farmAddress,
      farmCity,
      farmState,
      farmZipCode,
      farmPhone
    } = req.body;

    // Find user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update basic fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;

    // Update role-specific fields
    if (user.role === 'buyer') {
      if (address) user.address = address;
      if (city) user.city = city;
      if (state) user.state = state;
      if (zipCode) user.zipCode = zipCode;
      if (landmark) user.landmark = landmark;
    } else if (user.role === 'farmer') {
      if (farmName) user.farmName = farmName;
      if (farmLocation) user.farmLocation = farmLocation;
      if (farmAddress) user.farmAddress = farmAddress;
      if (farmCity) user.farmCity = farmCity;
      if (farmState) user.farmState = farmState;
      if (farmZipCode) user.farmZipCode = farmZipCode;
      if (farmPhone) user.farmPhone = farmPhone;
    }

    // Save user
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Find user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message
    });
  }
};

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  try {
    // In a JWT-based system, logout is typically handled client-side
    // by removing the token from storage
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
      error: error.message
    });
  }
};

module.exports = {
  register,
  registerAdmin,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
}; 