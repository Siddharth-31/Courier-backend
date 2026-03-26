const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
 origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/couriers', require('./routes/couriers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/tracking', require('./routes/tracking'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'SwiftRoute API running' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ MongoDB Connected');
    // Seed admin user if not exists
    const User = require('./models/User');
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      await User.create({
        name: 'System Admin',
        email: 'admin@swiftroute.com',
        password: 'admin123',
        phone: '9999999999',
        role: 'admin'
      });
      console.log('👤 Admin seeded: admin@swiftroute.com / admin123');
    }
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });
