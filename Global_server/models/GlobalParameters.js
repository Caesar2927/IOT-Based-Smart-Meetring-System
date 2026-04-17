const mongoose = require('mongoose');

const globalParametersSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  gridFrequency: {
    type: Number,
    required: true,
    min: 49.0,
    max: 51.0
  },
  gridStress: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  gridPrice: {
    type: Number,
    required: true,
    min: 0.0,
    max: 20.0
  },
  peakFlag: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  globalPowerFactor: {
    type: Number,
    required: true,
    min: 0.0,
    max: 1.0
  },
  source: {
    type: String,
    enum: ['SIMULATOR', 'MANUAL', 'RTU/SCADA'],
    default: 'SIMULATOR'
  },
  notes: String
});

globalParametersSchema.index({ timestamp: -1 });

// Keep only last 1000 records
globalParametersSchema.post('save', async function(doc) {
  const count = await mongoose.model('GlobalParameters').countDocuments();
  if (count > 1000) {
    await mongoose.model('GlobalParameters').deleteMany({
      _id: { $nin: (await mongoose.model('GlobalParameters').find().sort({ _id: -1 }).limit(1000).select('_id')) }
    });
  }
});

module.exports = mongoose.model('GlobalParameters', globalParametersSchema);
