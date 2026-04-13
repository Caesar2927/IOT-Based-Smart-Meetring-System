const cron = require('node-cron');
const globalSender = require('./globalSender');

class BillingManager {
  constructor() {
    // Track energy and stats per room
    this.roomStats = {};
    this.scheduleId = null;
  }

  /**
   * Initialize room stats tracking
   */
  initializeRoom(roomId) {
    if (!this.roomStats[roomId]) {
      this.roomStats[roomId] = {
        totalEnergyKWh: 0,
        voltages: [],
        powerFactors: [],
        powerValues: [],
        startTime: new Date(),
        dayCounter: 0
      };
    }
  }

  /**
   * Update room statistics with incoming data
   */
  updateRoomStats(roomId, data) {
    this.initializeRoom(roomId);

    const stats = this.roomStats[roomId];

    // Accumulate energy (assuming data.energy is incremental kWh)
    if (data.energy !== undefined) {
      stats.totalEnergyKWh += data.energy;
      stats.dayCounter++;
    }

    // Track voltage readings
    if (data.voltage !== undefined) {
      stats.voltages.push(data.voltage);
    }

    // Track power factor readings
    if (data.pf !== undefined) {
      stats.powerFactors.push(data.pf);
    }

    // Track power values to find peak
    if (data.power !== undefined) {
      stats.powerValues.push(data.power);
    }
  }

  /**
   * Calculate statistics for the day
   */
  calculateStats(roomId) {
    const stats = this.roomStats[roomId];

    if (!stats || stats.voltages.length === 0) {
      return null;
    }

    const avgVoltage = stats.voltages.reduce((a, b) => a + b, 0) / stats.voltages.length;
    const avgPowerFactor = stats.powerFactors.reduce((a, b) => a + b, 0) / stats.powerFactors.length;
    const peakPowerW = Math.max(...stats.powerValues);

    return {
      totalEnergyKWh: stats.totalEnergyKWh,
      avgVoltage: parseFloat(avgVoltage.toFixed(2)),
      avgPowerFactor: parseFloat(avgPowerFactor.toFixed(3)),
      peakPowerW: parseFloat(peakPowerW.toFixed(2))
    };
  }

  /**
   * Flush daily data for all rooms to Global Server
   */
  async flushAllRooms() {
    console.log('🌙 Starting midnight flush...');

    // Get today's date in YYYY-MM-DD format
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const flushPromises = [];

    for (const roomId in this.roomStats) {
      const calculatedStats = this.calculateStats(roomId);

      if (calculatedStats) {
        const payload = {
          room: roomId,
          date,
          totalEnergyKWh: calculatedStats.totalEnergyKWh,
          avgVoltage: calculatedStats.avgVoltage,
          avgPowerFactor: calculatedStats.avgPowerFactor,
          peakPowerW: calculatedStats.peakPowerW
        };

        console.log(`📊 Flushing daily data for ${roomId}:`, payload);

        flushPromises.push(
          globalSender.flushDailyData(payload)
            .then(() => {
              console.log(`✅ Flushed ${roomId}`);
              // Reset stats after successful flush
              this.roomStats[roomId] = {
                totalEnergyKWh: 0,
                voltages: [],
                powerFactors: [],
                powerValues: [],
                startTime: new Date(),
                dayCounter: 0
              };
            })
            .catch(err => {
              console.error(`❌ Failed to flush ${roomId}:`, err.message);
            })
        );
      }
    }

    try {
      await Promise.all(flushPromises);
      console.log('✅ All rooms flushed successfully');
    } catch (err) {
      console.error('❌ Error during flush:', err);
    }
  }

  /**
   * Start the midnight cron job
   * Runs at 00:00 (midnight) every day
   */
  startMidnightCron() {
    // Cron expression: 0 0 * * * (minute, hour, day, month, day-of-week)
    // This runs at 00:00 (midnight) every day
    this.scheduleId = cron.schedule('0 0 * * *', async () => {
      console.log('[Cron] Midnight trigger at', new Date());
      await this.flushAllRooms();
    });

    console.log('⏰ Midnight cron job scheduled (0 0 * * *)');
  }

  /**
   * Stop the cron job
   */
  stopMidnightCron() {
    if (this.scheduleId) {
      this.scheduleId.stop();
      console.log('⛔ Midnight cron stopped');
    }
  }

  /**
   * Manually trigger flush (for testing)
   */
  async manualFlush() {
    console.log('🔄 Manual flush triggered');
    await this.flushAllRooms();
  }

  /**
   * Get current room stats
   */
  getRoomStats() {
    return { ...this.roomStats };
  }

  /**
   * Get statistics for a specific room
   */
  getRoomStatistics(roomId) {
    return this.calculateStats(roomId);
  }
}

module.exports = new BillingManager();
