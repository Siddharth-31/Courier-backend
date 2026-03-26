const express = require('express');
const router = express.Router();
const Shipment = require('../models/Shipment');
const { protect, adminOnly } = require('../middleware/auth');

// Create shipment
router.post('/', protect, async (req, res) => {
  try {
    const shipment = await Shipment.create({ ...req.body, createdBy: req.user._id });
    await shipment.populate('assignedCourier', 'name email');
    res.status(201).json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user's own shipments
router.get('/my', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    const query = { createdBy: req.user._id };
    if (status) query.status = status;
    if (search) query.$or = [
      { trackingId: { $regex: search, $options: 'i' } },
      { 'recipient.name': { $regex: search, $options: 'i' } }
    ];
    const total = await Shipment.countDocuments(query);
    const shipments = await Shipment.find(query)
      .populate('assignedCourier', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, shipments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single shipment (owner or admin)
router.get('/:id', protect, async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('assignedCourier', 'name email phone')
      .populate('createdBy', 'name email');
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found.' });
    if (req.user.role !== 'admin' && shipment.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    res.json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Cancel shipment (owner)
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) return res.status(404).json({ success: false, message: 'Not found.' });
    if (shipment.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    if (['delivered', 'cancelled'].includes(shipment.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this shipment.' });
    }
    shipment.status = 'cancelled';
    shipment.trackingHistory.push({ status: 'cancelled', description: 'Shipment cancelled by user', updatedBy: req.user._id });
    await shipment.save();
    res.json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
