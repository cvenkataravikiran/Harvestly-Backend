const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productImage: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  unit: {
    type: String,
    required: true
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sellerName: {
    type: String,
    required: true
  },
  farmName: {
    type: String,
    required: true
  }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true
  },
  buyerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  buyerName: {
    type: String,
    required: true
  },
  buyerEmail: {
    type: String,
    required: true
  },
  buyerPhone: {
    type: String,
    required: true
  },
  items: [orderItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  shipping: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  // Shipping address
  shippingAddress: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    zipCode: {
      type: String,
      required: true
    },
    landmark: {
      type: String
    }
  },
  // Order status
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  // Payment information
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    default: 'razorpay'
  },
  paymentId: {
    type: String,
    default: null
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  // Logistics
  trackingNumber: {
    type: String,
    default: null
  },
  estimatedDelivery: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  // Logistics timeline
  logistics: [{
    status: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    location: {
      type: String,
      default: null
    }
  }],
  // Order notes
  notes: {
    type: String,
    default: null
  },
  // Cancellation
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    default: null
  },
  // Commission
  commission: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for complete shipping address
orderSchema.virtual('completeShippingAddress').get(function() {
  const addr = this.shippingAddress;
  return `${addr.address}, ${addr.city}, ${addr.state} - ${addr.zipCode}`;
});

// Virtual for order summary
orderSchema.virtual('orderSummary').get(function() {
  return {
    totalItems: this.items.length,
    totalQuantity: this.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: this.totalAmount,
    status: this.status
  };
});

// Indexes for better query performance
orderSchema.index({ buyerId: 1 });
orderSchema.index({ orderId: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

// Generate order ID before saving
orderSchema.pre('save', function(next) {
  if (!this.isModified('orderId')) {
    // Generate order ID if not provided
    if (!this.orderId) {
      const timestamp = Date.now().toString().slice(-8);
      const random = Math.random().toString(36).substr(2, 4).toUpperCase();
      this.orderId = `ORD${timestamp}${random}`;
    }
    
    // Initialize logistics timeline
    if (this.logistics.length === 0) {
      this.logistics.push({
        status: 'Order Placed',
        description: 'Your order has been successfully placed',
        timestamp: new Date()
      });
    }
  }
  next();
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus, description, location = null) {
  this.status = newStatus;
  this.logistics.push({
    status: newStatus,
    description: description,
    timestamp: new Date(),
    location: location
  });
  
  if (newStatus === 'Delivered') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'Cancelled') {
    this.cancelledAt = new Date();
  }
  
  return this.save();
};

// Method to update payment status
orderSchema.methods.updatePaymentStatus = function(status, paymentId = null) {
  this.paymentStatus = status;
  if (paymentId) {
    this.paymentId = paymentId;
  }
  return this.save();
};

// Static method to find by buyer
orderSchema.statics.findByBuyer = function(buyerId) {
  return this.find({ buyerId }).sort({ createdAt: -1 });
};

// Static method to find by seller
orderSchema.statics.findBySeller = function(sellerId) {
  return this.find({ 'items.sellerId': sellerId }).sort({ createdAt: -1 });
};

// Static method to find pending orders
orderSchema.statics.findPending = function() {
  return this.find({ status: 'Pending' }).sort({ createdAt: -1 });
};

// Static method to calculate total sales
orderSchema.statics.calculateTotalSales = function(startDate, endDate) {
  const matchStage = {
    status: 'Delivered',
    paymentStatus: 'Paid'
  };
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.aggregate([
    { $match: matchStage },
    { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
  ]);
};

module.exports = mongoose.model('Order', orderSchema); 