const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// This will be set by the main index.js
let espClients = {};
let tariffFetcher = null;
let dsmManager = null;

/**
 * Initialize tariff fetcher reference (called from index.js)
 */
app.setTariffFetcher = (fetcher) => {
  tariffFetcher = fetcher;
};

/**
 * Initialize DSM manager reference (called from index.js)
 */
app.setDsmManager = (manager) => {
  dsmManager = manager;
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

/**
 * ============================================================================
 * DSM (DEMAND SIDE MANAGEMENT) ENDPOINTS
 * ============================================================================
 */

/**
 * POST /api/dsm/evaluate
 * Evaluate appliances for DSM load shedding
 * Body: { roomId, appliances: [{applianceId, loadImportance, localPowerFactor, loadPower}, ...] }
 */
app.post('/api/dsm/evaluate', (req, res) => {
  try {
    if (!dsmManager) {
      return res.status(500).json({ message: 'DSM Manager not initialized' });
    }

    const { roomId, appliances } = req.body;

    if (!roomId || !appliances) {
      return res.status(400).json({ message: 'Missing roomId or appliances' });
    }

    // Evaluate all appliances in the room
    const evaluations = dsmManager.evaluateRoom(roomId, appliances);

    // Send relay actions to ESP
    evaluations.forEach((evaluation) => {
      if (evaluation.relayAction && evaluation.relayAction !== 'NO_CHANGE') {
        const target = espClients[roomId];
        if (target && target.readyState === 1) {
          const relayCommand = {
            type: 'relay_action',
            applianceId: evaluation.applianceId,
            action: evaluation.relayAction,
            cutScore: evaluation.cutScore,
            timestamp: new Date(),
          };
          target.send(JSON.stringify(relayCommand));
        }
      }
    });

    res.json({
      roomId,
      evaluations,
      message: 'Appliances evaluated and relay actions sent',
    });
  } catch (error) {
    console.error('❌ DSM evaluation error:', error);
    res.status(500).json({ message: 'DSM evaluation failed', error: error.message });
  }
});

/**
 * GET /api/dsm/global-params
 * Get current global grid parameters cached by DSM Manager
 */
app.get('/api/dsm/global-params', (req, res) => {
  try {
    if (!dsmManager) {
      return res.status(500).json({ message: 'DSM Manager not initialized' });
    }

    const globalParams = dsmManager.getGlobalParameters();
    res.json(globalParams);
  } catch (error) {
    console.error('❌ Error getting global params:', error);
    res.status(500).json({ message: 'Failed to get global parameters' });
  }
});

/**
 * GET /api/dsm/history
 * Get recent DSM evaluation history
 * Query: ?limit=20
 */
app.get('/api/dsm/history', (req, res) => {
  try {
    if (!dsmManager) {
      return res.status(500).json({ message: 'DSM Manager not initialized' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const history = dsmManager.getEvaluationHistory(limit);

    res.json({
      count: history.length,
      evaluations: history,
    });
  } catch (error) {
    console.error('❌ Error getting evaluation history:', error);
    res.status(500).json({ message: 'Failed to get evaluation history' });
  }
});

/**
 * GET /api/dsm/relay-state/:applianceId
 * Get current relay state for an appliance
 */
app.get('/api/dsm/relay-state/:applianceId', (req, res) => {
  try {
    if (!dsmManager) {
      return res.status(500).json({ message: 'DSM Manager not initialized' });
    }

    const { applianceId } = req.params;
    const relayState = dsmManager.getRelayState(applianceId);

    res.json({
      applianceId,
      relayState,
    });
  } catch (error) {
    console.error('❌ Error getting relay state:', error);
    res.status(500).json({ message: 'Failed to get relay state' });
  }
});

/**
 * POST /api/dsm/reset
 * Reset all relay states (for testing/debugging)
 */
app.post('/api/dsm/reset', (req, res) => {
  try {
    if (!dsmManager) {
      return res.status(500).json({ message: 'DSM Manager not initialized' });
    }

    dsmManager.resetRelayStates();
    res.json({ message: 'All relay states reset' });
  } catch (error) {
    console.error('❌ Error resetting relay states:', error);
    res.status(500).json({ message: 'Failed to reset relay states' });
  }
});

module.exports = app;
