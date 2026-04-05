const axios = require('axios');

const globalUrl = process.env.GLOBAL_SERVER_URL;

async function sendReading(reading) {
  if (!globalUrl) {
    return;
  }

  const payload = {
    esp: reading.esp,
    current: reading.current,
    voltage: reading.voltage,
    power: reading.power,
    status: reading.status,
    time: reading.time,
    receivedAt: reading.receivedAt,
    id: reading._id,
  };

  await axios.post(globalUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
  });

  console.log('🌐 Forwarded data to global server');
}

module.exports = {
  sendReading,
};
