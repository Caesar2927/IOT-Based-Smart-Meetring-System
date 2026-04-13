const express = require('express');
const LiveStats = require('../models/LiveStats');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/stats/push
 * Called by Local Server every 5 seconds to push latest sensor readings
 * Protected - requires JWT from Local Server
 */
router.post('/push', auth, async (req, res) => {
  try {
    const { room, voltage, current, power, pf, phase, energy, cost, load } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!room || voltage === undefined || current === undefined || power === undefined ||
        pf === undefined || phase === undefined || energy === undefined || cost === undefined || !load) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Upsert into LiveStats collection
    // If record exists for this userId and room, update it; otherwise create new
    const liveStats = await LiveStats.findOneAndUpdate(
      { userId, room },
      {
        voltage,
        current,
        power,
        pf,
        phase,
        energy,
        cost,
        load,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Stats updated successfully',
      stats: liveStats
    });
  } catch (err) {
    console.error('Push stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/stats/live
 * Get latest LiveStats for all rooms of the logged-in user
 * Protected - requires JWT
 */
router.get('/live', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Find all live stats for this user across all rooms
    const liveStats = await LiveStats.find({ userId });

    res.json(liveStats);
  } catch (err) {
    console.error('Get live stats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
