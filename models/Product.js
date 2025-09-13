const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative']
  },
  category: {
    type: String,
    enum: ['Organic', 'Fertilized'],
    required: [true, 'Product category is required']
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  unit: {
    type: String,
    required: [true, 'Unit is required'],
    enum: ['kg', 'piece', 'dozen', 'bundle', 'gram'],
    default: 'kg'
  },
  image: {
    type: String,
    required: [true, 'Product image is required']
  },
  // Seller information
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller ID is required']
  },
  sellerName: {
    type: String,
    required: [true, 'Seller name is required']
  },
  farmName: {
    type: String,
    required: [true, 'Farm name is required']
  },
  // Farm location details
  farmLocation: {
    type: String,
    required: [true, 'Farm location is required'],
    trim: true
  },
  farmAddress: {
    type: String,
    required: [true, 'Farm address is required'],
    trim: true
  },
  farmCity: {
    type: String,
    required: [true, 'Farm city is required'],
    trim: true
  },
  farmState: {
    type: String,
    required: [true, 'Farm state is required'],
    trim: true
  },
  farmZipCode: {
    type: String,
    required: [true, 'Farm ZIP code is required'],
    match: [/^[1-9][0-9]{5}$/, 'Please enter a valid 6-digit ZIP code']
  },
  farmPhone: {
    type: String,
    required: [true, 'Farm phone is required'],
    match: [/^(\+91[\-\s]?)?[0]?(91)?[789]\d{9}$/, 'Please enter a valid Indian phone number']
  },
  // Product status
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  // Product metrics
  views: {
    type: Number,
    default: 0
  },
  sales: {
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
  },
  // Approval details
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectionReason: {
    type: String,
    default: null
  },
  // Product features
  isFeatured: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  // SEO fields
  slug: {
    type: String,
    lowercase: true
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for complete farm address
productSchema.virtual('completeFarmAddress').get(function() {
  return `${this.farmAddress}, ${this.farmCity}, ${this.farmState} - ${this.farmZipCode}`;
});

// Virtual for price per unit display
productSchema.virtual('priceDisplay').get(function() {
  return `₹${this.price} per ${this.unit}`;
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'Out of Stock';
  if (this.stock <= 10) return 'Low Stock';
  return 'In Stock';
});

// Indexes for better query performance
productSchema.index({ sellerId: 1 });
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isAvailable: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ price: 1 });
productSchema.index({ name: 'text', description: 'text' });

// Generate slug before saving
productSchema.pre('save', function(next) {
  if (!this.isModified('name')) return next();
  
  const baseSlug = this.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  
  // Add timestamp to make slug unique
  const timestamp = Date.now();
  this.slug = `${baseSlug}-${timestamp}`;
  
  next();
});

// Method to update stock
productSchema.methods.updateStock = function(quantity) {
  this.stock = Math.max(0, this.stock - quantity);
  return this.save();
};

// Method to increment views
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to increment sales
productSchema.methods.incrementSales = function(quantity) {
  this.sales += quantity;
  return this.save();
};

// Static method to find approved products
productSchema.statics.findApproved = function() {
  return this.find({ status: 'Approved', isAvailable: true });
};

// Static method to find by seller
productSchema.statics.findBySeller = function(sellerId) {
  return this.find({ sellerId });
};

// Static method to search products
productSchema.statics.search = function(query) {
  return this.find({
    $and: [
      { status: 'Approved', isAvailable: true },
      {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { category: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  });
};

module.exports = mongoose.model('Product', productSchema); 