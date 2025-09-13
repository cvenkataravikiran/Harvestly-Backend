const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { preventRoleEscalation } = require('../middleware/adminSecurity');
const { 
  registerValidation, 
  loginValidation, 
  profileUpdateValidation 
} = require('../middleware/validation');

// Public routes
router.post('/register', registerValidation, preventRoleEscalation, authController.register);
router.post('/login', loginValidation, authController.login);

// Secure admin registration (requires admin code)
router.post('/admin/register', preventRoleEscalation, authController.registerAdmin);

// Protected routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/profile', authenticateToken, profileUpdateValidation, authController.updateProfile);
router.put('/change-password', authenticateToken, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router; 