const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ success: false, message: 'Not authorized. No token.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ success: false, message: 'User not found.' });
    if (!req.user.isActive) return res.status(401).json({ success: false, message: 'Account deactivated.' });
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token invalid or expired.' });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required.' });
  next();
};

exports.courierOrAdmin = (req, res, next) => {
  if (!['admin', 'courier'].includes(req.user.role)) return res.status(403).json({ success: false, message: 'Access denied.' });
  next();
};
