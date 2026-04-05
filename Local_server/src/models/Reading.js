const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    esp: { type: String, required: true, trim: true },
    current: { type: Number, default: 0 },
    voltage: { type: Number, default: 0 },
    power: { type: Number, default: 0 },
    status: { type: String, default: 'ONLINE' },
    time: { type: String },
    receivedAt: { type: Date, default: Date.now },
    raw: { type: mongoose.Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Reading', readingSchema);
