const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// This will be set by the main index.js
let espClients = {};
let tariffFetcher = null;

/**
 * Initialize tariff fetcher reference (called from index.js)
 */
app.setTariffFetcher = (fetcher) => {
  tariffFetcher = fetcher;
};

/**
 * POST /api/control
 * Receive relay control commands from Global Server and forward to ESP32 via WebSocket
 * Body: { room, load1, load2 }
 */
app.post('/api/control', (req, res) => {
  try {
    const { room, load1, load2 } = req.body;

    if (!room) {
      return res.status(400).json({ message: 'Missing room parameter' });
    }

    const target = espClients[room];

    if (!target || target.readyState !== 1) { // WebSocket.OPEN
      return res.status(404).json({
        message: `ESP ${room} not connected`,
        connectedESPs: Object.keys(espClients)
      });
    }

    // Send control command to ESP via WebSocket
    const controlMessage = {
      type: 'control',
      esp: room,
      load1: load1 !== undefined ? load1 : null,
      load2: load2 !== undefined ? load2 : null,
      timestamp: new Date()
    };

    target.send(JSON.stringify(controlMessage));
    console.log(`🎮 Control command sent to ${room}:`, controlMessage);

    res.json({
      message: `Control command sent to ${room}`,
      command: controlMessage
    });
  } catch (err) {
    console.error('❌ Control API error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/control/status
 * Get list of connected ESPs
 */
app.get('/api/control/status', (req, res) => {
  const connectedESPs = Object.keys(espClients).map(esp => ({
    esp,
    connected: espClients[esp].readyState === 1
  }));

  res.json({
    connectedCount: connectedESPs.length,
    connectedESPs
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

/**
 * GET /api/price/current
 * Get current cached price slab from Global Server
 */
app.get('/api/price/current', (req, res) => {
  if (!tariffFetcher) {
    return res.status(500).json({ message: 'Tariff fetcher not initialized' });
  }

  const priceData = tariffFetcher.getCurrentPrice();
  const status = tariffFetcher.getStatus();

  res.json({
    status: priceData ? 'available' : 'not_fetched_yet',
    currentPrice: priceData,
    fetcherStatus: status
  });
});

/**
 * Set ESP clients reference (called from wsServer setup)
 */
app.setEspClients = (clients) => {
  espClients = clients;
};

module.exports = app;
