const axios = require('axios');

class GlobalSender {
  constructor() {
    this.retryQueue = [];
    this.isProcessing = false;
    this.currentPriceSlab = null; // Cache for current price slab
    this.lastPriceFetch = null;
  }

  /**
   * Get Global Server URL from environment
   */
  getGlobalServerUrl() {
    return process.env.GLOBAL_SERVER_URL;
  }

  /**
   * Get JWT token from environment
   */
  getJwtToken() {
    return process.env.USER_JWT;
  }

  /**
   * Helper: Get current time as 15-minute block index (0-95)
   * Example: 12:00 (720 minutes) = index 48
   */
  getCurrentTimeIndex() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const index = Math.floor(totalMinutes / 15);
    return index;
  }

  /**
   * Fetch current price slab from Global Server
   * Uses time index: (current_hours * 60 + current_minutes) / 15
   */
  async fetchCurrentPriceSlab() {
    const GLOBAL_SERVER_URL = this.getGlobalServerUrl();
    const USER_JWT = this.getJwtToken();

    if (!GLOBAL_SERVER_URL || !USER_JWT) {
      console.log('⚠️ Missing GLOBAL_SERVER_URL or USER_JWT, cannot fetch price');
      return null;
    }

    try {
      const recordIndex = this.getCurrentTimeIndex();
      
      const response = await axios.post(
        `${GLOBAL_SERVER_URL}/api/tariff/by-index`,
        { recordIndex },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_JWT}`
          },
          timeout: 5000
        }
      );

      this.currentPriceSlab = response.data;
      this.lastPriceFetch = new Date();
      
      // Detailed logging of fetched price
      const logTime = this.lastPriceFetch.toLocaleTimeString();
      console.log(
        `💰 Price fetched at ${logTime}:`
      );
      console.log(
        `   📊 Date: ${response.data.date} | Index: ${recordIndex} (${response.data.estimatedTime}) | TimeBlock: ${response.data.timeBlock}`
      );
      console.log(
        `   💵 MCP: Rs ${response.data.mcpRsMWh}/MWh`
      );
      
      return response.data;
    } catch (error) {
      console.error('❌ Failed to fetch current price slab:', error.message);
      return null;
    }
  }

  /**
   * Get cached price slab
   */
  getCurrentCachedPrice() {
    return this.currentPriceSlab;
  }

  /**
   * Get last price fetch timestamp
   */
  getLastPriceFetchTime() {
    return this.lastPriceFetch;
  }

  /**
   * Send reading to Global Server's /api/stats/push endpoint
   * Handles retry queue if server is unreachable
   */
  async sendReading(reading) {
    const GLOBAL_SERVER_URL = this.getGlobalServerUrl();
    const USER_JWT = this.getJwtToken();

    if (!GLOBAL_SERVER_URL) {
      return;
    }

    // Transform local reading format to Global Server format
    const payload = {
      room: reading.esp,
      voltage: reading.voltage,
      current: reading.current,
      power: reading.power,
      pf: reading.pf,
      phase: reading.phase || 0,
      energy: reading.energy || 0,
      cost: reading.cost || 0,
      load: reading.load || 'Unknown'
    };

    try {
      await axios.post(
        `${GLOBAL_SERVER_URL}/api/stats/push`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_JWT}`
          },
          timeout: 5000
        }
      );

      console.log('🌐 Sent to Global Server:', reading.esp);

      // If send successful and retry queue has items, try to process queue
      if (this.retryQueue.length > 0) {
        this.processRetryQueue();
      }
    } catch (error) {
      console.error('⚠️ Failed to send to Global Server:', error.message);

      // Add to retry queue if under max retries
      if (this.retryQueue.length < MAX_RETRY_QUEUE) {
        this.retryQueue.push({
          payload,
          timestamp: Date.now(),
          retries: 0
        });
        console.log(`📋 Added to retry queue (${this.retryQueue.length}/${MAX_RETRY_QUEUE})`);
      } else {
        console.error('❌ Retry queue full, dropping oldest entry');
        this.retryQueue.shift(); // Remove oldest
        this.retryQueue.push({
          payload,
          timestamp: Date.now(),
          retries: 0
        });
      }
    }
  }

  /**
   * Process retry queue to resend failed readings
   */
  async processRetryQueue() {
    const GLOBAL_SERVER_URL = this.getGlobalServerUrl();
    const USER_JWT = this.getJwtToken();

    if (this.isProcessing || this.retryQueue.length === 0 || !GLOBAL_SERVER_URL) {
      return;
    }

    this.isProcessing = true;

    while (this.retryQueue.length > 0) {
      const item = this.retryQueue[0];

      try {
        await axios.post(
          `${GLOBAL_SERVER_URL}/api/stats/push`,
          item.payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${USER_JWT}`
            },
            timeout: 5000
          }
        );

        this.retryQueue.shift();
        console.log(`✅ Retry successful. Queue size: ${this.retryQueue.length}`);
      } catch (error) {
        item.retries++;
        if (item.retries > 3) {
          this.retryQueue.shift();
          console.error('❌ Max retries exceeded, dropping item');
        } else {
          console.log(`⏳ Retry ${item.retries}/3 failed, will try again`);
          break; // Stop processing if this one fails
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * Send daily flush to Global Server's /api/billing/flush endpoint
   */
  async flushDailyData(flushPayload) {
    const GLOBAL_SERVER_URL = this.getGlobalServerUrl();
    const USER_JWT = this.getJwtToken();

    if (!GLOBAL_SERVER_URL) {
      console.log('⚠️ GLOBAL_SERVER_URL not set, skipping daily flush');
      return;
    }

    if (!USER_JWT) {
      console.log('⚠️ USER_JWT not set, skipping daily flush');
      return;
    }

    try {
      // flushPayload should be:
      // { room, date, totalEnergyKWh, avgVoltage, avgPowerFactor, peakPowerW }

      const response = await axios.post(
        `${GLOBAL_SERVER_URL}/api/billing/flush`,
        flushPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_JWT}`
          },
          timeout: 10000
        }
      );

      console.log('💾 Daily data flushed to Global Server for room:', flushPayload.room);
      return response.data;
    } catch (error) {
      console.error('❌ Daily flush failed:', error.message);
      throw error;
    }
  }

  /**
   * Get current retry queue status
   */
  getQueueStatus() {
    return {
      queueSize: this.retryQueue.length,
      maxSize: MAX_RETRY_QUEUE,
      isProcessing: this.isProcessing,
      oldestItem: this.retryQueue[0] || null
    };
  }

  /**
   * Trigger manual retry queue processing
   */
  async manualRetryProcess() {
    console.log('🔄 Manual retry process triggered');
    await this.processRetryQueue();
  }
}

module.exports = new GlobalSender();
