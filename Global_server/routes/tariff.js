const express = require('express');
const IEXPrice = require('../models/IEXPrice');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Helper function to convert a 15-minute block index to time string
 * Index 0 = 00:00, 1 = 00:15, 2 = 00:30, 48 = 12:00, 95 = 23:45
 */
const indexToTime = (index) => {
  if (index < 0 || index > 95) return null;
  const totalMinutes = index * 15;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Helper function to convert a time string to the closest 15-minute block index
 * Returns index 0-95, where each index represents a 15-minute Block
 * "12:00" returns 48, "12:15" returns 49, "12:30" returns 50
 */
const timeToIndex = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const totalMinutes = hours * 60 + minutes;
  const index = Math.floor(totalMinutes / 15);
  return index;
};

/**
 * Helper function to get current time block index
 */
const getCurrentTimeBlockIndex = () => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const index = Math.floor(totalMinutes / 15);
  return index;
};

/**
 * Helper function to get today's date as YYYY-MM-DD
 */
const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * GET /api/tariff/today
 * Return today's IEXPrice records from DB (scraped every 15 min)
 * Protected - requires JWT
 */
router.get('/today', auth, async (req, res) => {
  try {
    const today = getTodayDate();

    // Find all IEX price records for today, sorted by sequential index
    const prices = await IEXPrice.find({ date: today }).sort({ recordIndex: 1 });

    res.json({
      date: today,
      prices: prices,
      count: prices.length
    });
  } catch (err) {
    console.error('Get today tariff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/tariff/current
 * Return the single IEXPrice record matching the current 15-minute time block
 * Protected - requires JWT
 */
router.get('/current', auth, async (req, res) => {
  try {
    const today = getTodayDate();
    const currentIndex = getCurrentTimeBlockIndex();
    const currentTime = indexToTime(currentIndex);

    // Find the IEX price record for current time block using sequential index
    const price = await IEXPrice.findOne({
      date: today,
      recordIndex: currentIndex  // Query by sequential index (0-95)
    });

    if (!price) {
      return res.status(404).json({
        message: 'No tariff data available for current time block',
        currentTime: currentTime,
        currentIndex: currentIndex,
        date: today
      });
    }

    res.json({
      date: today,
      currentTime: currentTime,
      currentIndex: currentIndex,
      price: price
    });
  } catch (err) {
    console.error('Get current tariff error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/tariff/by-index
 * Get tariff price for a specific 15-minute block index
 * Body: { recordIndex: 0-95 } (optional date, defaults to today)
 * Protected - requires JWT
 * 
 * Example: POST /api/tariff/by-index with body { "recordIndex": 48 }
 * Returns: IEXPrice record for index 48 (12:00 time block)
 */
router.post('/by-index', auth, async (req, res) => {
  try {
    const { recordIndex, date } = req.body;

    if (recordIndex === undefined || recordIndex === null) {
      return res.status(400).json({
        message: 'Missing required field: recordIndex',
        example: { recordIndex: 48, date: '2026-04-13' }
      });
    }

    if (recordIndex < 0 || recordIndex > 95) {
      return res.status(400).json({
        message: 'recordIndex must be between 0-95',
        provided: recordIndex
      });
    }

    const queryDate = date || getTodayDate();

    // Find the IEX price record using sequential index
    const price = await IEXPrice.findOne({
      date: queryDate,
      recordIndex: recordIndex
    });

    if (!price) {
      return res.status(404).json({
        message: 'No tariff data available for specified index',
        date: queryDate,
        recordIndex: recordIndex,
        timeBlock: indexToTime(recordIndex)
      });
    }

    res.json({
      date: queryDate,
      recordIndex: recordIndex,
      estimatedTime: indexToTime(recordIndex),
      timeBlock: price.timeBlock,
      mcpRsMWh: price.mcpRsMWh
    });
  } catch (err) {
    console.error('Get tariff by index error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/tariff/by-time?date=2024-01-15&time=12:00
 * Get tariff for a specific time (converted to index for robust search)
 * Protected - requires JWT
 * 
 * Example: /api/tariff/by-time?date=2024-01-15&time=12:00
 * Returns: IEXPrice record for 12:00-12:15 time block
 */
router.get('/by-time', auth, async (req, res) => {
  try {
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json({
        message: 'Missing required query parameters',
        required: ['date (YYYY-MM-DD)', 'time (HH:MM)'],
        example: '/api/tariff/by-time?date=2024-01-15&time=12:00'
      });
    }

    // Convert time string to index
    const index = timeToIndex(time);

    if (index === null || index < 0 || index > 95) {
      return res.status(400).json({
        message: 'Invalid time format or out of range',
        provided: time,
        format: 'HH:MM (24-hour)',
        example: '12:00'
      });
    }

    // Find the IEX price record using sequential index
    const price = await IEXPrice.findOne({
      date: date,
      recordIndex: index
    });

    if (!price) {
      return res.status(404).json({
        message: 'No tariff data available for specified time',
        date: date,
        time: time,
        index: index
      });
    }

    res.json({
      date: date,
      requestedTime: time,
      timeBlockIndex: index,
      price: price
    });
  } catch (err) {
    console.error('Get tariff by time error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
