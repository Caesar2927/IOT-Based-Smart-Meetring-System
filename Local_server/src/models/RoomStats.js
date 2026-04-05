const mongoose = require('mongoose');

const switchSchema = new mongoose.Schema({
  switchId: { type: String, required: true },
  current: { type: Number, default: 0 },
  power: { type: Number, default: 0 },
  powerFactor: { type: Number, default: 0 }
});

const roomStatsSchema = new mongoose.Schema({
  time: { type: Date, required: true, default: Date.now },
  roomId: { type: String, required: true },
  voltage: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  pf: { type: Number, default: 0 },
  power: { type: Number, default: 0 },
  switches: [switchSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('RoomStats', roomStatsSchema);