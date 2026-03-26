const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');
  
  const User = require('./models/User');
  
  // Delete existing admin
  await User.deleteMany({ email: 'admin@swiftroute.com' });
  console.log('Old admin deleted');

  // Create new admin with plain password
  // Let the model hash it via pre-save hook
  const admin = new User({
    name: 'System Admin',
    email: 'admin@swiftroute.com',
    password: 'admin123',
    phone: '9999999999',
    role: 'admin',
    isActive: true
  });

  await admin.save();
  console.log('✅ Admin created!');
  console.log('Email: admin@swiftroute.com');
  console.log('Password: admin123');
  process.exit(0);

}).catch(err => {
  console.log('❌ Error:', err.message);
  process.exit(1);
});