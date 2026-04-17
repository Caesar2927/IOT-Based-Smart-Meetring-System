const WebSocket = require('ws');
const readingService = require('./services/readingService');
const espDataCache = require('./services/espDataCache');
const dsmManager = require('./services/dsmManager');

let espClients = {};
let lastSeen = {};

function createWebSocketServer(port) {
  const wss = new WebSocket.Server({ port });

  console.log(`🚀 WebSocket server listening on port ${port}`);

  setInterval(() => {
    const now = Date.now();

    Object.keys(lastSeen).forEach((esp) => {
      if (now - lastSeen[esp] > 6000) {
        broadcast(wss, { type: 'status', esp, status: 'OFFLINE' });
        console.log('⚠️', esp, 'OFFLINE');

        // Remove offline ESP from cache
        espDataCache.removeEsp(esp);
      }
    });
  }, 3000);

  wss.on('connection', (ws) => {
    console.log('🔌 Client Connected');

    // Send current cache data to new client
    espDataCache.broadcastCurrentData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
      }
    });

    ws.on('message', async (msg) => {
      let data;

      try {
        data = JSON.parse(msg);
      } catch (error) {
        console.log('❌ Invalid JSON');
        return;
      }

      console.log('📩 Received:', data);

      if (data.type === 'register') {
        espClients[data.esp] = ws;
        lastSeen[data.esp] = Date.now();
        espDataCache.initializeEsp(data.esp);

        console.log('✅', data.esp, 'ONLINE');
        broadcast(wss, { type: 'status', esp: data.esp, status: 'ONLINE' });
        return;
      }

      if (data.type === 'control') {
        const target = espClients[data.esp];

        console.log(`🎮 Control Message Received:`, data);
        console.log(`📍 Target ESP (${data.esp}):`, target ? 'Connected' : 'NOT FOUND');
        console.log(`📊 Connected ESPs:`, Object.keys(espClients));

        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify(data));
          console.log(`✅ Control sent to ${data.esp}:`, JSON.stringify(data));
        } else {
          console.log(`❌ ESP ${data.esp} not connected or not ready`);
        }

        return;
      }

      if (data.type === 'data') {
        lastSeen[data.esp] = Date.now();

        try {
          // Update cache with new data
          espDataCache.updateEspData(data.esp, data);

          // Broadcast data from cache instead of raw incoming data
          const cachedData = espDataCache.getCacheData()[data.esp];
          if (cachedData) {
            broadcast(wss, { ...cachedData, type: 'data', esp: data.esp });
          }
          
          // Also broadcast status as ONLINE
          broadcast(wss, { type: 'status', esp: data.esp, status: 'ONLINE' });

          // ============================================================================
          // TRIGGER DSM EVALUATION FOR THIS ROOM
          // ============================================================================
          console.log(`\n📊 Data received from ${data.esp} | V:${data.voltage?.toFixed(1)}V | I:${data.current?.toFixed(2)}A | P:${data.power?.toFixed(1)}W | PF:${data.pf?.toFixed(3)}`);

          // Create appliance data from room metrics or use default
          const appliances = data.load && data.load.length > 0 
            ? data.load 
            : [
                {
                  applianceId: `${data.esp}_Load1`,
                  loadImportance: 3,  // Default importance
                  localPowerFactor: data.pf || 0.95,
                  loadPower: data.power || 0
                },
                {
                  applianceId: `${data.esp}_Load2`,
                  loadImportance: 2,
                  localPowerFactor: data.pf || 0.95,
                  loadPower: (data.power || 0) * 0.5  // Secondary load
                }
              ];

          // Call DSM Manager to evaluate
          const evaluations = dsmManager.evaluateRoom(data.esp, appliances);

          // Check if any appliance needs to be shed
          const needsShedding = evaluations.some(eval => eval.relayAction === 'OPEN' && eval.cutScore > 0.75);

          if (needsShedding) {
            console.log(`🔴 [CUTOFF COMMAND] Sending relay OFF to ${data.esp} - cutScore exceeds threshold`);
            
            // Send relay OFF command for both relays
            const relayOffCommand = {
              type: 'relay_action',
              esp: data.esp,
              relay1: 'OPEN',
              relay2: 'OPEN',
              timestamp: new Date(),
              reason: 'DSM Load Shedding'
            };

            const target = espClients[data.esp];
            if (target && target.readyState === WebSocket.OPEN) {
              target.send(JSON.stringify(relayOffCommand));
              console.log(`✅ RELAY OFF sent to ${data.esp}`);
            }
          }

        } catch (error) {
          console.error('❌ Error processing room data:', error.message);
        }
      }
    });

    ws.on('close', () => {
      console.log('❌ Client Disconnected');

      // Find and remove the disconnected ESP from clients and cache
      Object.keys(espClients).forEach(espId => {
        if (espClients[espId] === ws) {
          delete espClients[espId];
          delete lastSeen[espId];
          espDataCache.removeEsp(espId);
          console.log('🗑️ Removed', espId, 'from cache');
        }
      });
    });
  });


  return espClients;
}

function broadcast(wss, data) {
  const payload = JSON.stringify(data);

  if (!payload) return;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

module.exports = createWebSocketServer;
