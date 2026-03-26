const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId: { type: String, unique: true },
  zone: { type: String, required: true },
  vehicle: {
    type: { type: String, enum: ['bike','scooter','van','truck'], default: 'bike' },
    number: String,
    model: String
  },
  isAvailable: { type: Boolean, default: true },
  currentLocation: { type: String },
  totalDeliveries: { type: Number, default: 0 },
  successfulDeliveries: { type: Number, default: 0 },
  rating: { type: Number, default: 5.0, min: 0, max: 5 },
  earnings: { type: Number, default: 0 },
  joiningDate: { type: Date, default: Date.now }
}, { timestamps: true });

courierSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Courier').countDocuments();
    this.employeeId = 'EMP' + String(count + 1).padStart(4, '0');
  }
  next();
});

module.exports = mongoose.model('Courier', courierSchema);
