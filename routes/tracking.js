// routes/tracking.js
const express = require('express');
const router = express.Router();
const Shipment = require('../models/Shipment');

// Public tracking by tracking ID
router.get('/:trackingId', async (req, res) => {
  try {
    const shipment = await Shipment.findOne({ trackingId: req.params.trackingId.toUpperCase() })
      .select('-createdBy -__v')
      .populate('assignedCourier', 'name phone');
    if (!shipment) return res.status(404).json({ success: false, message: 'Shipment not found. Check tracking ID.' });
    res.json({ success: true, shipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
