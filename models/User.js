const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  role: {
    type: String,
    enum: ['buyer', 'farmer', 'admin'],
    default: 'buyer'
  },
  address: {
    type: String,
    required: function() { return this.role === 'buyer'; },
    trim: true
  },
  city: {
    type: String,
    required: function() { return this.role === 'buyer'; },
    trim: true
  },
  state: {
    type: String,
    required: function() { return this.role === 'buyer'; },
    trim: true
  },
  zipCode: {
    type: String,
    required: function() { return this.role === 'buyer'; },
    match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit ZIP code']
  },
  landmark: {
    type: String,
    trim: true
  },
  // Farmer specific fields
  farmName: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    trim: true
  },
  farmLocation: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    trim: true
  },
  farmAddress: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    trim: true
  },
  farmCity: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    trim: true
  },
  farmState: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    trim: true
  },
  farmZipCode: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit ZIP code']
  },
  farmPhone: {
    type: String,
    required: function() { return this.role === 'farmer'; },
    match: [/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  // Admin specific fields - SEPARATE from farmer fields
  adminOrgName: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    trim: true
  },
  adminOfficeLocation: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    trim: true
  },
  adminOfficeAddress: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    trim: true
  },
  adminOfficeCity: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    trim: true
  },
  adminOfficeState: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    trim: true
  },
  adminOfficeZipCode: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit ZIP code']
  },
  adminOfficePhone: {
    type: String,
    required: false,
    // function() { return this.role === 'admin'; },
    match: [/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: null
  },
  // Stats for sellers
  totalProducts: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for complete address
userSchema.virtual('completeAddress').get(function() {
  if (this.role === 'buyer') {
    return `${this.address}, ${this.city}, ${this.state} - ${this.zipCode}`;
  } else if (this.role === 'farmer') {
    return `${this.farmAddress}, ${this.farmCity}, ${this.farmState} - ${this.farmZipCode}`;
  } else if (this.role === 'admin') {
    return `${this.adminOfficeAddress}, ${this.adminOfficeCity}, ${this.adminOfficeState} - ${this.adminOfficeZipCode}`;
  }
  return '';
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.__v;
  return userObject;
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

module.exports = mongoose.model('User', userSchema); 