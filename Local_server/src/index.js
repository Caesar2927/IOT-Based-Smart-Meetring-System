const dotenv = require('dotenv');
const connectDatabase = require('./db');
const createWebSocketServer = require('./wsServer');
const espDataCache = require('./services/espDataCache');

dotenv.config();

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await connectDatabase(process.env.MONGODB_URI);
    createWebSocketServer(PORT);

    // Start periodic saving of ESP data to MongoDB
    espDataCache.startPeriodicSave();
    console.log('⏰ Started periodic data saving (every 5 seconds)');

    console.log(`✅ Smart Energy Server running on port ${PORT}`);
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
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down server...');
  espDataCache.stopPeriodicSave();
  process.exit(0);
});
