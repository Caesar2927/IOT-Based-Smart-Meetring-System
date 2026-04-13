const mongoose = require('mongoose');

const liveStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  room: {
    type: String,
    required: true
    // "room1" or "room2"
  },
  voltage: {
    type: Number,
    required: true
  },
  current: {
    type: Number,
    required: true
  },
  power: {
    type: Number,
    required: true
  },
  pf: {
    type: Number,
    required: true
    // Power Factor
  },
  phase: {
    type: Number,
    required: true
    // Phase angle
  },
  energy: {
    type: Number,
    required: true
    // Energy in kWh
  },
  cost: {
    type: Number,
    required: true
    // Cost in INR
  },
  load: {
    type: String,
    required: true
    // Load type detected on ESP32
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries by userId and room
liveStatsSchema.index({ userId: 1, room: 1 }, { unique: true });

module.exports = mongoose.model('LiveStats', liveStatsSchema);
