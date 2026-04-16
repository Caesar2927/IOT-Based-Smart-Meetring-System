/**
 * DSM Manager - Demand Side Management
 * Local_server: Fetches global params and evaluates loads using fuzzy logic
 */

const axios = require('axios');
const fuzzyEngine = require('./fuzzyEngine');

class DSMManager {
  constructor() {
    this.globalParams = null;
    this.globalServerURL = process.env.GLOBAL_SERVER_URL || 'http://localhost:5000';
    this.fetchInterval = 10000; // Fetch every 10 seconds
    this.intervalId = null;
    this.loadRelayState = {}; // Track relay state for hysteresis {applianceId: action}
    this.evaluationHistory = []; // Store recent evaluations
    this.maxHistorySize = 100;
  }

  /**
   * Start fetching global parameters periodically
   */
  startGlobalParamsFetch() {
    console.log('🌍 Starting DSM Manager - fetching global parameters every 10s');

    this.intervalId = setInterval(() => {
      this.fetchGlobalParameters();
    }, this.fetchInterval);

    // Initial fetch
    this.fetchGlobalParameters();
  }

  /**
   * Fetch global parameters from Global Server
   */
  async fetchGlobalParameters() {
    try {
      const response = await axios.get(`${this.globalServerURL}/api/dsm/global-params`, {
        timeout: 5000,
      });

      this.globalParams = response.data;
      console.log(
        `📊 Global params updated:`,
        `Freq=${this.globalParams.gridFrequency.toFixed(2)}Hz`,
        `Stress=${this.globalParams.gridStress.toFixed(2)}`,
        `Price=₹${this.globalParams.gridPrice.toFixed(2)}`
      );
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.warn(
          '⚠️ DSM: Cannot connect to Global Server. Using default parameters.'
        );
      } else {
        console.warn('⚠️ DSM: Failed to fetch global parameters:', error.message);
      }

      // Use default parameters if connection fails
      if (!this.globalParams) {
        this.globalParams = {
          timestamp: Date.now(),
          gridFrequency: 50.0,
          gridStress: 0.5,
          gridPrice: 5.5,
          peakFlag: 0.5,
          globalPowerFactor: 0.95,
        };
      }
    }
  }

  /**
   * Stop fetching global parameters
   */
  stopGlobalParamsFetch() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('🛑 DSM Manager stopped');
    }
  }

  /**
   * Evaluate a single appliance/load using fuzzy logic
   * @param {Object} localData - Room appliance data
   * @returns {Object} - Actuation command (cutScore, relayAction)
   */
  evaluateAppliance(localData) {
    if (!this.globalParams) {
      console.warn('⚠️ DSM: Global params not yet available');
      return {
        applianceId: localData.applianceId,
        cutScore: 0.5,
        relayAction: 'NO_CHANGE',
        status: 'No global params',
      };
    }

    // Get previous relay state for hysteresis
    const previousState = this.loadRelayState[localData.applianceId];

    // Evaluate using fuzzy engine
    const evaluation = fuzzyEngine.evaluateLoad(
      this.globalParams,
      localData,
      previousState
    );

    // Update relay state
    if (evaluation.relayAction && evaluation.relayAction !== 'NO_CHANGE') {
      this.loadRelayState[localData.applianceId] = evaluation.relayAction;
    }

    // Store in history
    this.evaluationHistory.push({
      ...evaluation,
      timestamp: Date.now(),
    });

    // Trim history
    if (this.evaluationHistory.length > this.maxHistorySize) {
      this.evaluationHistory.shift();
    }

    return evaluation;
  }

  /**
   * Evaluate all appliances in a room
   * @param {string} roomId - Room identifier
   * @param {Array} appliances - Array of appliance data
   * @returns {Array} - Array of actuation commands
   */
  evaluateRoom(roomId, appliances) {
    if (!Array.isArray(appliances)) {
      console.warn(`⚠️ DSM: Invalid appliances array for room ${roomId}`);
      return [];
    }

    return appliances.map((appliance) => {
      const applianceWithRoom = {
        ...appliance,
        roomId,
      };
      return this.evaluateAppliance(applianceWithRoom);
    });
  }

  /**
   * Get evaluation history for debugging
   * @param {number} limit - Max number of latest evaluations to return
   */
  getEvaluationHistory(limit = 20) {
    return this.evaluationHistory.slice(-limit);
  }

  /**
   * Get current global parameters
   */
  getGlobalParameters() {
    return this.globalParams || {};
  }

  /**
   * Get current relay state for an appliance
   */
  getRelayState(applianceId) {
    return this.loadRelayState[applianceId] || 'UNKNOWN';
  }

  /**
   * Reset relay state (for testing)
   */
  resetRelayStates() {
    this.loadRelayState = {};
    console.log('🔄 Relay states reset');
  }
}

module.exports = new DSMManager();
