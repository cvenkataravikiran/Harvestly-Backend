const { validateAdminCreation } = require('../config/adminWhitelist');

// Enhanced admin middleware - only checks admin role, no email restrictions
const requireSecureAdmin = (req, res, next) => {
  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }

  // Log admin access for security monitoring
  console.log(`🔐 Admin access: ${req.user.email} - ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  
  next();
};

// Middleware to log all admin actions
const logAdminAction = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    const adminAction = {
      adminEmail: req.user.email,
      action: `${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    console.log('🔍 Admin Action Log:', adminAction);
  }
  next();
};

// Middleware to prevent admin role escalation - only checks admin code
const preventRoleEscalation = (req, res, next) => {
  if (req.body.role === 'admin') {
    const adminValidation = validateAdminCreation(
      req.body.email, 
      req.body.adminCode
    );
    
    if (!adminValidation.isValid) {
      return res.status(403).json({
        success: false,
        message: adminValidation.message
      });
    }
  }
  next();
};

module.exports = {
  requireSecureAdmin,
  logAdminAction,
  preventRoleEscalation
}; 