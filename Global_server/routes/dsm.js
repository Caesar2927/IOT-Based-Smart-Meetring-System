/**
 * DSM Route - Broadcast Global Grid Parameters
 * Global_server: Provides grid context for Local Server's fuzzy logic
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

// Global parameters cache (in production, this would come from grid monitoring systems)
let globalParameters = {
  timestamp: Date.now(),
  gridFrequency: 50.0, // Hz
  gridStress: 0.5, // 0-1 scale
  gridPrice: 5.5, // ₹/kWh
  peakFlag: 0.5, // 0-1 scale (0=off-peak, 1=peak)
  globalPowerFactor: 0.95, // 0-1 scale
};

/**
 * Simulate grid parameters (in real system, these come from RTU/SCADA)
 */
function simulateGridParameters() {
  // Simulate grid frequency (oscillates around 50 Hz)
  globalParameters.gridFrequency = 49.9 + Math.sin(Date.now() / 10000) * 0.5;

  // Simulate grid stress (gradually increases during peak hours)
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const timeOfDay = (hour * 60 + minute) / 1440; // 0-1 scale

  // Peak hours: 10 AM - 2 PM, 6 PM - 10 PM
  const isPeakTime =
    (hour >= 10 && hour < 14) || (hour >= 18 && hour < 22);
  globalParameters.gridStress = isPeakTime ? 0.7 + Math.random() * 0.2 : 0.4 + Math.random() * 0.2;
  globalParameters.peakFlag = isPeakTime ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.2;

  // Simulate price variation
  if (isPeakTime) {
    globalParameters.gridPrice = 7.0 + Math.random() * 3.0; // Higher during peak
  } else {
    globalParameters.gridPrice = 4.0 + Math.random() * 2.0; // Lower during off-peak
  }

  // Power factor oscillates
  globalParameters.globalPowerFactor = 0.92 + Math.sin(Date.now() / 5000) * 0.05;

  globalParameters.timestamp = Date.now();
  return globalParameters;
}

/**
 * GET /api/dsm/global-params
 * Retrieve current global grid parameters
 */
router.get('/global-params', (req, res) => {
  try {
    const params = simulateGridParameters();
    res.json(params);
  } catch (error) {
    console.error('❌ Error retrieving global parameters:', error);
    res.status(500).json({ message: 'Failed to retrieve parameters' });
  }
});

/**
 * POST /api/dsm/global-params (admin only)
 * Update global grid parameters (for testing/simulation)
 */
router.post('/global-params', authMiddleware, (req, res) => {
  try {
    const { gridFrequency, gridStress, gridPrice, peakFlag, globalPowerFactor } = req.body;

    // Validate ranges
    if (gridFrequency !== undefined) {
      if (gridFrequency < 49 || gridFrequency > 51) {
        return res.status(400).json({ error: 'gridFrequency must be between 49-51 Hz' });
      }
      globalParameters.gridFrequency = gridFrequency;
    }

    if (gridStress !== undefined) {
      if (gridStress < 0 || gridStress > 1) {
        return res.status(400).json({ error: 'gridStress must be between 0-1' });
      }
      globalParameters.gridStress = gridStress;
    }

    if (gridPrice !== undefined) {
      if (gridPrice < 0 || gridPrice > 20) {
        return res.status(400).json({ error: 'gridPrice must be between 0-20' });
      }
      globalParameters.gridPrice = gridPrice;
    }

    if (peakFlag !== undefined) {
      if (peakFlag < 0 || peakFlag > 1) {
        return res.status(400).json({ error: 'peakFlag must be between 0-1' });
      }
      globalParameters.peakFlag = peakFlag;
    }

    if (globalPowerFactor !== undefined) {
      if (globalPowerFactor < 0 || globalPowerFactor > 1) {
        return res.status(400).json({ error: 'globalPowerFactor must be between 0-1' });
      }
      globalParameters.globalPowerFactor = globalPowerFactor;
    }

    globalParameters.timestamp = Date.now();

    res.json({
      message: 'Global parameters updated',
      parameters: globalParameters,
    });
  } catch (error) {
    console.error('❌ Error updating global parameters:', error);
    res.status(500).json({ message: 'Failed to update parameters' });
  }
});

/**
 * GET /api/dsm/health
 * Health check for DSM system
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'DSM System OK',
    lastUpdate: globalParameters.timestamp,
    currentParameters: simulateGridParameters(),
  });
});

module.exports = router;
