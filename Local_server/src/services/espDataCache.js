const { RoomStats } = require('../models');
const globalSender = require('./globalSender');

class EspDataCache {
  constructor() {
    this.cache = {}; // espId -> latest data
    this.intervalId = null;
    this.saveInterval = 5000; // 5 seconds
  }

  // Initialize cache for connected ESPs
  initializeEsp(espId) {
    if (!this.cache[espId]) {
      this.cache[espId] = {
        roomId: espId,
        voltage: 0,
        current: 0,
        pf: 0,
        power: 0,
        switches: [] // Will be populated based on structure
      };
    }
  }

  // Update data for an ESP
  updateEspData(espId, data) {
    this.initializeEsp(espId);

    this.cache[espId] = {
      roomId: espId,
      voltage: data.voltage || 0,
      current: data.current || 0,
      pf: data.pf || 0,
      power: data.power || 0,
      switches: data.switches || this.cache[espId].switches
    };

    // Send to global server
    this.sendToGlobalServer(espId);
  }

  // Send data to global server
  sendToGlobalServer(espId) {
    const data = this.cache[espId];
    if (!data) return;

    const payload = {
      esp: data.roomId,
      current: data.current,
      voltage: data.voltage,
      power: data.power,
      status: 'ONLINE',
      time: new Date().toLocaleTimeString(),
      receivedAt: new Date(),
      pf: data.pf,
      load: data.load || 'Unknown'
    };

    globalSender.sendReading(payload).catch((error) => {
      console.error('⚠️ Global server forward failed:', error.message);
    });
  }

  // Get current cache data
  getCacheData() {
    return { ...this.cache };
  }

  // Start periodic saving to MongoDB
  startPeriodicSave() {
    this.intervalId = setInterval(async () => {
      await this.saveToDatabase();
    }, this.saveInterval);
  }

  // Stop periodic saving
  stopPeriodicSave() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Save current cache data to MongoDB
  async saveToDatabase() {
    const cacheData = this.getCacheData();
    const savePromises = [];

    for (const espId in cacheData) {
      const data = cacheData[espId];
      const roomStats = new RoomStats({
        time: new Date(),
        ...data
      });

      savePromises.push(
        roomStats.save().catch(error => {
          console.error(`❌ Failed to save RoomStats for ${espId}:`, error.message);
        })
      );
    }

    try {
      await Promise.all(savePromises);
      console.log('💾 RoomStats saved to database for all ESPs');
    } catch (error) {
      console.error('❌ Error saving RoomStats batch:', error.message);
    }
  }

  // Remove ESP from cache (when disconnected)
  removeEsp(espId) {
    delete this.cache[espId];
  }

  // Get number of connected ESPs
  getConnectedEspCount() {
    return Object.keys(this.cache).length;
  }

  // Get all current ESP data (for frontend or other services)
  getAllEspData() {
    return Object.values(this.cache);
  }

  // Broadcast current cache data to WebSocket clients
  broadcastCurrentData(broadcastFunction) {
    const allData = this.getAllEspData();
    allData.forEach(data => {
      broadcastFunction({ ...data, type: 'data' });
    });
  }
}

module.exports = new EspDataCache();