const cron = require('node-cron');
const globalSender = require('./globalSender');

class TariffFetcher {
  constructor() {
    this.cronJob = null;
  }

  /**
   * Start 15-minute interval cron job to fetch current price slab from Global Server
   * First, fetches price immediately on startup (no waiting for next 15-min interval)
   * Then runs at: 00, 15, 30, 45 minutes of every hour
   */
  async startPriceFetchCron() {
    try {
      // Fetch price immediately on startup (don't wait for next 15-min slab)
      console.log('[Tariff Fetcher] Fetching initial price on startup...');
      const initialPrice = await globalSender.fetchCurrentPriceSlab();
      if (initialPrice) {
        console.log(`✅ Initial price fetch successful - Rs ${initialPrice.mcpRsMWh}/MWh`);
      } else {
        console.log('⚠️ Initial price fetch failed, will retry on next interval');
      }
    } catch (err) {
      console.error('❌ Error during initial price fetch:', err.message);
    }

    // Schedule to run every 15 minutes (at :00, :15, :30, :45)
    this.cronJob = cron.schedule('*/15 * * * *', async () => {
      console.log('[Tariff Fetcher] [Cron Job] Fetching current price slab from Global Server...');
      await globalSender.fetchCurrentPriceSlab();
    });

    console.log('📊 Tariff fetcher cron started (every 15 minutes at :00, :15, :30, :45)');
  }

  /**
   * Stop the cron job
   */
  stopPriceFetchCron() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('📊 Tariff fetcher cron stopped');
    }
  }

  /**
   * Get current cached price slab
   */
  getCurrentPrice() {
    return globalSender.getCurrentCachedPrice();
  }

  /**
   * Get price fetch status
   */
  getStatus() {
    const price = globalSender.getCurrentCachedPrice();
    const lastFetch = globalSender.getLastPriceFetchTime();
    
    return {
      hasCachedPrice: price !== null,
      cachedPrice: price,
      lastFetchTime: lastFetch,
      currentTimeIndex: globalSender.getCurrentTimeIndex()
    };
  }
}

module.exports = new TariffFetcher();
