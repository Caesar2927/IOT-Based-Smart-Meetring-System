const dotenv = require('dotenv');

// Load environment variables FIRST before importing other modules
dotenv.config();

const connectDatabase = require('./db');
const createWebSocketServer = require('./wsServer');
const espDataCache = require('./services/espDataCache');
const billingManager = require('./services/billingManager');
const tariffFetcher = require('./services/tariffFetcher');
const dsmManager = require('./services/dsmManager');
const httpServer = require('./httpServer');

const WS_PORT = process.env.WS_PORT || 8080;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

async function startServer() {
  try {
    await connectDatabase(process.env.MONGODB_URI);
    
    // Create WebSocket server and get the espClients reference
    const espClients = createWebSocketServer(WS_PORT);

    // Start periodic saving of ESP data to MongoDB
    espDataCache.startPeriodicSave();
    console.log('⏰ Started periodic data saving (every 5 seconds)');

    // Initialize billing manager with midnight cron job
    billingManager.startMidnightCron();
    console.log('💳 Billing manager initialized with midnight cron');

    // Start tariff fetcher to get price every 15 minutes from Global Server
    await tariffFetcher.startPriceFetchCron();
    console.log('💰 Tariff fetcher initialized (fetches price every 15 minutes)');

    // Start DSM Manager to fetch global params and evaluate loads
    dsmManager.startGlobalParamsFetch();
    console.log('⚡ DSM Manager initialized (fetches global params every 10 seconds)');

    // Start HTTP control server
    httpServer.setEspClients(espClients);
    httpServer.setTariffFetcher(tariffFetcher);
    httpServer.setDsmManager(dsmManager);
    httpServer.listen(HTTP_PORT, () => {
      console.log(`🌐 HTTP control server running on port ${HTTP_PORT}`);
    });

    console.log(`✅ Smart Energy Services running (WS: ${WS_PORT}, HTTP: ${HTTP_PORT})`);
  } catch (error) {
    console.error('❌ Server start failed:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down server...');
  espDataCache.stopPeriodicSave();
  billingManager.stopMidnightCron();
  tariffFetcher.stopPriceFetchCron();
  dsmManager.stopGlobalParamsFetch();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  espDataCache.stopPeriodicSave();
  billingManager.stopMidnightCron();
  tariffFetcher.stopPriceFetchCron();
  process.exit(0);
});
