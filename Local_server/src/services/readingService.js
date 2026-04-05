const Reading = require('../models/Reading');
const globalSender = require('./globalSender');

function sanitizeNumber(value, max, defaultValue = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return defaultValue;
  }
  return max != null ? Math.min(parsed, max) : parsed;
}

function buildReadingPayload(payload) {
  return {
    esp: String(payload.esp || 'unknown'),
    current: sanitizeNumber(payload.current, 10),
    voltage: sanitizeNumber(payload.voltage, 300),
    power: sanitizeNumber(payload.power, null),
    status: 'ONLINE',
    time: new Date().toLocaleTimeString(),
    receivedAt: new Date(),
    raw: payload,
  };
}

async function handleEspData(payload) {
  const reading = buildReadingPayload(payload);

  try {
    const saved = await Reading.create(reading);
    globalSender.sendReading(saved).catch((error) => {
      console.error('⚠️ Global server forward failed:', error.message);
    });
    return saved.toObject();
  } catch (error) {
    console.error('❌ Failed to save reading:', error.message);
    throw error;
  }
}

module.exports = {
  handleEspData,
};
