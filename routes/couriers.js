const express = require('express');
const router = express.Router();
const Courier = require('../models/Courier');
const { protect } = require('../middleware/auth');

// Get available couriers (for dropdown)
router.get('/', protect, async (req, res) => {
  try {
    const couriers = await Courier.find({ isAvailable: true }).populate('user', 'name email phone');
    res.json({ success: true, couriers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
