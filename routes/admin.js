const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Shipment = require('../models/Shipment');
const Courier = require('../models/Courier');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ─── DASHBOARD STATS ─────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [
      totalShipments, totalUsers, totalCouriers,
      pending, inTransit, delivered, failed, cancelled,
      todayShipments, revenue
    ] = await Promise.all([
      Shipment.countDocuments(),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'courier' }),
      Shipment.countDocuments({ status: 'pending' }),
      Shipment.countDocuments({ status: 'in_transit' }),
      Shipment.countDocuments({ status: 'delivered' }),
      Shipment.countDocuments({ status: 'failed' }),
      Shipment.countDocuments({ status: 'cancelled' }),
      Shipment.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Shipment.aggregate([{ $group: { _id: null, total: { $sum: '$price.total' } } }])
    ]);

    const monthlyData = await Shipment.aggregate([
      { $group: {
        _id: { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } },
        count: { $sum: 1 },
        revenue: { $sum: '$price.total' }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({ success: true, stats: {
      totalShipments, totalUsers, totalCouriers,
      pending, inTransit, delivered, failed, cancelled,
      todayShipments, totalRevenue: revenue[0]?.total || 0,
      monthlyData
    }});
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ALL SHIPMENTS ────────────────────────────────────────
router.get('/shipments', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.$or = [
      { trackingId: { $regex: search, $options: 'i' } },
      { 'sender.name': { $regex: search, $options: 'i' } },
      { 'recipient.name': { $regex: search, $options: 'i' } },
      { 'recipient.city': { $regex: search, $options: 'i' } }
    ];
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };
    const total = await Shipment.countDocuments(query);
    const shipments = await Shipment.find(query)
      .populate('assignedCourier', 'name phone')
      .populate('createdBy', 'name email')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, shipments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update shipment status
router.put('/shipments/:id/status', async (req, res) => {
  try {
    const { status, location, description } = req.body;
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found.' });
    shipment.status = status;
    shipment.trackingHistory.push({ status, location, description: description || `Status updated to ${status}`, updatedBy: req.user._id, timestamp: new Date() });
    if (status === 'delivered') shipment.actualDelivery = new Date();
    await shipment.save();
    res.json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Assign courier to shipment
router.put('/shipments/:id/assign', async (req, res) => {
  try {
    const { courierId } = req.body;
    const shipment = await Shipment.findByIdAndUpdate(
      req.params.id,
      { assignedCourier: courierId },
      { new: true }
    ).populate('assignedCourier', 'name phone');
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found.' });
    shipment.trackingHistory.push({ status: shipment.status, description: 'Courier assigned', updatedBy: req.user._id });
    await shipment.save();
    res.json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete shipment
router.delete('/shipments/:id', async (req, res) => {
  try {
    await Shipment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Shipment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ALL USERS ────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};
    if (role) query.role = role;
    if (search) query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
    const total = await User.countDocuments(query);
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    res.json({ success: true, users, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle user active status
router.put('/users/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Not found.' });
    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Change user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { role: req.body.role }, { new: true });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Create courier profile for user
router.post('/couriers', async (req, res) => {
  try {
    const { userId, zone, vehicleType, vehicleNumber, vehicleModel } = req.body;
    const user = await User.findByIdAndUpdate(userId, { role: 'courier' }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    const courier = await Courier.create({
      user: userId, zone,
      vehicle: { type: vehicleType, number: vehicleNumber, model: vehicleModel }
    });
    res.status(201).json({ success: true, courier });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get all couriers
router.get('/couriers', async (req, res) => {
  try {
    const couriers = await Courier.find().populate('user', 'name email phone isActive');
    res.json({ success: true, couriers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
