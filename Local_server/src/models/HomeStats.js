const mongoose = require('mongoose');

const roomEnergySchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  energy: { type: Number, default: 0 }
});

const homeStatsSchema = new mongoose.Schema({
  time: { type: Date, required: true, default: Date.now },
  voltage: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  power: { type: Number, default: 0 },
  powerFactor: { type: Number, default: 0 },
  rooms: [roomEnergySchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('HomeStats', homeStatsSchema);