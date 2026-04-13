const express = require('express');
const DailyReading = require('../models/DailyReading');
const IEXPrice = require('../models/IEXPrice');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Helper function to get date as YYYY-MM-DD
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * POST /api/billing/flush
 * Called by Local Server at midnight to save daily energy readings
 * Body: { room, date, totalEnergyKWh, avgVoltage, avgPowerFactor, peakPowerW }
 * Protected - requires JWT
 */
router.post('/flush', auth, async (req, res) => {
  try {
    const { room, date, totalEnergyKWh, avgVoltage, avgPowerFactor, peakPowerW } = req.body;
    const userId = req.user.userId;

    // Validate input
    if (!room || !date || totalEnergyKWh === undefined || avgVoltage === undefined ||
        avgPowerFactor === undefined || peakPowerW === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Fetch today's IEXPrice records from DB, sorted by sequential index for consistent ordering
    const iexPrices = await IEXPrice.find({ date }).sort({ recordIndex: 1 });

    if (iexPrices.length === 0) {
      return res.status(400).json({
        message: 'No tariff data available for the given date',
        date
      });
    }

    // Calculate weighted average MCP
    let totalMCP = 0;
    let totalBlocks = iexPrices.length;
    iexPrices.forEach(price => {
      totalMCP += price.mcpRsMWh;
    });
    const weightedAvgMCP = totalMCP / totalBlocks;

    // Calculate cost: totalEnergyKWh × weightedAvgMCP / 1000
    // (MCP is in Rs/MWh, we need Rs/kWh)
    const costINR = (totalEnergyKWh * weightedAvgMCP) / 1000;

    // Create tariffSnapshot from IEXPrice records
    const tariffSnapshot = iexPrices.map(price => ({
      timeBlock: price.timeBlock,
      mcpRsMWh: price.mcpRsMWh
    }));

    // Save to DailyReading collection
    const dailyReading = await DailyReading.findOneAndUpdate(
      { userId, date, room },
      {
        totalEnergyKWh,
        costINR,
        avgVoltage,
        avgPowerFactor,
        peakPowerW,
        tariffSnapshot
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Daily reading flushed successfully',
      reading: dailyReading,
      calculatedCost: costINR,
      weightedAvgMCP
    });
  } catch (err) {
    console.error('Flush billing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/billing/history
 * Get DailyReading records for logged-in user in date range
 * Query params: ?from=YYYY-MM-DD&to=YYYY-MM-DD (optional)
 * Protected - requires JWT
 */
router.get('/history', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { from, to, room } = req.query;

    // Build query filter
    const filter = { userId };

    // Add date range filter if provided
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }

    // Filter by room if provided
    if (room) {
      filter.room = room;
    }

    // Query DailyReading collection
    const readings = await DailyReading.find(filter).sort({ date: -1 });

    res.json({
      count: readings.length,
      filter,
      readings
    });
  } catch (err) {
    console.error('Get billing history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/billing/summary
 * Get this month's total energy (kWh) and total cost (INR) per room
 * Protected - requires JWT
 */
router.get('/summary', auth, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get current date
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Create date range for current month (YYYY-MM-DD format)
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    
    // Calculate next month's first day or today
    const monthEnd = formatDate(now);

    // Aggregate by room
    const summary = await DailyReading.aggregate([
      {
        $match: {
          userId: require('mongoose').Types.ObjectId(userId),
          date: { $gte: monthStart, $lte: monthEnd }
        }
      },
      {
        $group: {
          _id: '$room',
          totalEnergyKWh: { $sum: '$totalEnergyKWh' },
          totalCostINR: { $sum: '$costINR' },
          avgVoltage: { $avg: '$avgVoltage' },
          avgPowerFactor: { $avg: '$avgPowerFactor' },
          peakPowerW: { $max: '$peakPowerW' },
          readingCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      month: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
      period: { from: monthStart, to: monthEnd },
      roomSummaries: summary,
      grandTotal: summary.reduce((acc, room) => ({
        energyKWh: acc.energyKWh + room.totalEnergyKWh,
        costINR: acc.costINR + room.totalCostINR
      }), { energyKWh: 0, costINR: 0 })
    });
  } catch (err) {
    console.error('Get billing summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
