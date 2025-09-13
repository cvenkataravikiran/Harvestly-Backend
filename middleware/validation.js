const { validationResult, body } = require('express-validator');

// Middleware to check validation results
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }))
    });
  }
  
  next();
};

// Validation rules for user registration
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .matches(/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/)
    .withMessage('Please enter a valid Indian phone number'),
  body('role')
    .isIn(['buyer', 'farmer', 'admin'])
    .withMessage('Role must be either buyer, farmer, or admin'),
  
  // Custom validation middleware for role-specific fields
  (req, res, next) => {
    const { role } = req.body;
    
    if (role === 'buyer') {
      // Validate buyer fields
      if (!req.body.address || req.body.address.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'address', message: 'Address is required for buyers' }]
        });
      }
      if (!req.body.city || req.body.city.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'city', message: 'City is required for buyers' }]
        });
      }
      if (!req.body.state || req.body.state.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'state', message: 'State is required for buyers' }]
        });
      }
      if (!req.body.zipCode || !/^[1-9][0-9]{5}$/.test(req.body.zipCode)) {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'zipCode', message: 'Please enter a valid 6-digit ZIP code for buyers' }]
        });
      }
    } else if (role === 'farmer') {
      // Validate farmer fields
      if (!req.body.farmName || req.body.farmName.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmName', message: 'Farm name is required for farmers' }]
        });
      }
      if (!req.body.farmLocation || req.body.farmLocation.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmLocation', message: 'Farm location is required for farmers' }]
        });
      }
      if (!req.body.farmAddress || req.body.farmAddress.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmAddress', message: 'Farm address is required for farmers' }]
        });
      }
      if (!req.body.farmCity || req.body.farmCity.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmCity', message: 'Farm city is required for farmers' }]
        });
      }
      if (!req.body.farmState || req.body.farmState.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmState', message: 'Farm state is required for farmers' }]
        });
      }
      if (!req.body.farmZipCode || !/^[1-9][0-9]{5}$/.test(req.body.farmZipCode)) {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmZipCode', message: 'Please enter a valid 6-digit ZIP code for farmers' }]
        });
      }
      if (!req.body.farmPhone || !/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/.test(req.body.farmPhone)) {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'farmPhone', message: 'Please enter a valid Indian phone number for farm' }]
        });
      }
    } else if (role === 'admin') {
      // Validate admin fields - SEPARATE from farmer fields
      if (!req.body.adminCode || req.body.adminCode.trim() === '') {
        return res.status(400).json({
          success: false,
          errors: [{ field: 'adminCode', message: 'Admin code is required for admin registration' }]
        });
      }
    //   if (!req.body.adminOrgName || req.body.adminOrgName.trim() === '') {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOrgName', message: 'Organization name is required for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficeLocation || req.body.adminOfficeLocation.trim() === '') {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficeLocation', message: 'Office location is required for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficeAddress || req.body.adminOfficeAddress.trim() === '') {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficeAddress', message: 'Office address is required for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficeCity || req.body.adminOfficeCity.trim() === '') {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficeCity', message: 'Office city is required for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficeState || req.body.adminOfficeState.trim() === '') {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficeState', message: 'Office state is required for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficeZipCode || !/^[1-9][0-9]{5}$/.test(req.body.adminOfficeZipCode)) {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficeZipCode', message: 'Please enter a valid 6-digit ZIP code for admin' }]
    //     });
    //   }
    //   if (!req.body.adminOfficePhone || !/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/.test(req.body.adminOfficePhone)) {
    //     return res.status(400).json({
    //       success: false,
    //       errors: [{ field: 'adminOfficePhone', message: 'Please enter a valid Indian phone number for admin' }]
    //     });
    //   }
    }
    
    next();
  },
  
  validate
];

// Validation rules for user login
const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please enter a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

// Validation rules for product creation
const productValidation = [
  body('name')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Product name must be between 3 and 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('category')
    .isIn(['Organic', 'Fertilized'])
    .withMessage('Category must be either Organic or Fertilized'),
  body('stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('unit')
    .isIn(['kg', 'piece', 'dozen', 'bundle', 'gram'])
    .withMessage('Unit must be one of: kg, piece, dozen, bundle, gram'),
  body('farmLocation')
    .trim()
    .notEmpty()
    .withMessage('Farm location is required'),
  body('farmAddress')
    .trim()
    .notEmpty()
    .withMessage('Farm address is required'),
  body('farmCity')
    .trim()
    .notEmpty()
    .withMessage('Farm city is required'),
  body('farmState')
    .trim()
    .notEmpty()
    .withMessage('Farm state is required'),
  body('farmZipCode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Please enter a valid 6-digit ZIP code'),
  body('farmPhone')
    .matches(/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/)
    .withMessage('Please enter a valid Indian phone number'),
  validate
];

// Validation rules for order creation
const orderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('shippingAddress.address')
    .trim()
    .notEmpty()
    .withMessage('Shipping address is required'),
  body('shippingAddress.city')
    .trim()
    .notEmpty()
    .withMessage('Shipping city is required'),
  body('shippingAddress.state')
    .trim()
    .notEmpty()
    .withMessage('Shipping state is required'),
  body('shippingAddress.zipCode')
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Please enter a valid 6-digit ZIP code'),
  validate
];

// Validation rules for profile update
const profileUpdateValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('phone')
    .optional()
    .matches(/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/)
    .withMessage('Please enter a valid Indian phone number'),
  body('address')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Address cannot be empty'),
  body('city')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('City cannot be empty'),
  body('state')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('State cannot be empty'),
  body('zipCode')
    .optional()
    .matches(/^[1-9][0-9]{5}$/)
    .withMessage('Please enter a valid 6-digit ZIP code'),
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  productValidation,
  orderValidation,
  profileUpdateValidation
}; 