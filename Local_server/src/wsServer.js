const WebSocket = require('ws');
const readingService = require('./services/readingService');
const espDataCache = require('./services/espDataCache');

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

        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify(data));
          console.log('🎮 Control sent to', data.esp);
        } else {
          console.log('❌ ESP not connected:', data.esp);
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
            broadcast(wss, { ...cachedData, type: 'data' });
            console.log('📊 Cached data broadcasted for', data.esp);
          }
        } catch (error) {
          console.error('❌ Error caching ESP data:', error.message);
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
