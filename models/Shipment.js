const mongoose = require('mongoose');

const trackingEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  location: { type: String },
  description: { type: String },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const shipmentSchema = new mongoose.Schema({
  trackingId: { type: String, unique: true },

  // Sender
  sender: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String }
  },

  // Recipient
  recipient: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String }
  },

  // Package
  packageDetails: {
    weight: { type: Number, required: true },
    type: { type: String, enum: ['documents','small_parcel','medium_parcel','large_parcel','fragile','electronics','clothing','food'], default: 'small_parcel' },
    dimensions: { length: Number, width: Number, height: Number },
    description: { type: String },
    declaredValue: { type: Number, default: 0 }
  },

  // Service
  serviceType: { type: String, enum: ['standard','express','same_day','economy'], default: 'standard' },
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },

  // Status
  status: {
    type: String,
    enum: ['pending','confirmed','picked_up','in_transit','out_for_delivery','delivered','failed','returned','cancelled'],
    default: 'pending'
  },

  // Tracking history
  trackingHistory: [trackingEventSchema],

  // Pricing
  price: {
    base: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
    paymentMethod: { type: String, enum: ['cash','online','cod'], default: 'cash' }
  },

  // Assignment
  assignedCourier: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Notes
  notes: { type: String },
  priority: { type: String, enum: ['low','normal','high','urgent'], default: 'normal' },

  // Proof of delivery
  deliveryProof: {
    signature: String,
    photo: String,
    notes: String
  }

}, { timestamps: true });

// Auto-generate tracking ID
shipmentSchema.pre('save', async function(next) {
  if (this.isNew && !this.trackingId) {
    const count = await mongoose.model('Shipment').countDocuments();
    this.trackingId = 'SR' + String(Date.now()).slice(-6) + String(count + 1).padStart(4, '0');
  }
  // Calculate estimated delivery
  if (this.isNew) {
    const days = { standard: 5, express: 2, same_day: 0, economy: 10 };
    const d = new Date();
    d.setDate(d.getDate() + (days[this.serviceType] || 5));
    this.estimatedDelivery = d;
  }
  // Calculate price
  const w = this.packageDetails.weight;
  const rates = { standard: 50, express: 100, same_day: 200, economy: 30 };
  const base = (rates[this.serviceType] || 50) + (w * 20);
  this.price.base = Math.round(base);
  this.price.tax = Math.round(base * 0.18);
  this.price.total = Math.round(base + base * 0.18);
  next();
});

// Add initial tracking event on create
shipmentSchema.pre('save', function(next) {
  if (this.isNew) {
    this.trackingHistory.push({
      status: 'pending',
      location: this.sender.city,
      description: 'Shipment booked successfully',
      timestamp: new Date()
    });
  }
  next();
});

module.exports = mongoose.model('Shipment', shipmentSchema);
