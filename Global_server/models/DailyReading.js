const mongoose = require('mongoose');

const dailyReadingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    required: true
    // Format: "YYYY-MM-DD"
  },
  room: {
    type: String,
    required: true
    // "room1" or "room2"
  },
  totalEnergyKWh: {
    type: Number,
    required: true
  },
  costINR: {
    type: Number,
    required: true
  },
  avgVoltage: {
    type: Number,
    required: true
  },
  avgPowerFactor: {
    type: Number,
    required: true
  },
  peakPowerW: {
    type: Number,
    required: true
  },
  tariffSnapshot: [
    {
      timeBlock: String,    // "06:00-06:15"
      mcpRsMWh: Number
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying
dailyReadingSchema.index({ userId: 1, date: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('DailyReading', dailyReadingSchema);
