const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'http://localhost:3000,http://127.0.0.1:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests and local tools without an Origin header.
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

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

let connectPromise;

const connectDB = async () => {
  if (!connectPromise) {
    connectPromise = mongoose.connect(process.env.MONGO_URI).then(async () => {
      console.log('✅ MongoDB Connected');

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
    });
  }

  return connectPromise;
};

if (!process.env.VERCEL) {
  connectDB()
    .then(() => {
      app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
    })
    .catch(err => {
      console.error('❌ MongoDB connection error:', err.message);
      process.exit(1);
    });
}

module.exports = app;
