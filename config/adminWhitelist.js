// Admin Security Configuration
// Admin codes are required for admin registration (no email restrictions)

// Admin creation codes (for additional security) - read from environment
const ADMIN_CODES = process.env.ADMIN_CODES
  ? process.env.ADMIN_CODES.split(',').map(code => code.trim())
  : [
      'HARVESTLY_ADMIN_2024',
      'SUPER_ADMIN_2024',
      // Add more admin codes here
      // 'YOUR_ADMIN_CODE',
    ];

// Check if admin code is valid
const isValidAdminCode = (code) => {
  return ADMIN_CODES.includes(code);
};

// Validate admin creation - only checks admin code, no email restrictions
const validateAdminCreation = (email, adminCode = null) => {
  if (!adminCode || !isValidAdminCode(adminCode)) {
    return {
      isValid: false,
      message: 'Valid admin code is required for admin registration'
    };
  }

  return {
    isValid: true,
    message: 'Admin creation authorized'
  };
};

module.exports = {
  ADMIN_CODES,
  isValidAdminCode,
  validateAdminCreation
}; 