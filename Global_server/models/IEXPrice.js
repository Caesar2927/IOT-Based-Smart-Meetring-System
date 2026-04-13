const mongoose = require('mongoose');

const iexPriceSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
    // Format: "YYYY-MM-DD"
  },
  timeBlock: {
    type: String,
    required: true
    // Format: "HH:MM-HH:MM" (e.g., "12:00-12:15")
  },
  recordIndex: {
    type: Number,
    required: true
    // Sequential index based on order received from API
    // 0-based: first record = 0, second = 1, etc.
    // Typically 0-95 for 24 hourly blocks (~every 15 min)
  },
  mcpRsMWh: {
    type: Number,
    required: true
    // MCP (Market Clearing Price) in Rs/MWh
  },
  fetchedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient querying and to prevent duplicates
// Using recordIndex instead of timeBlockIndex for sequential ordering
iexPriceSchema.index({ date: 1, recordIndex: 1 }, { unique: true });

// Additional index for date queries
iexPriceSchema.index({ date: 1 });

module.exports = mongoose.model('IEXPrice', iexPriceSchema);
