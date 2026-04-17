/**
 * DSM Route - Broadcast Global Grid Parameters
 * Global_server: Provides grid context for Local Server's fuzzy logic
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const GlobalParameters = require('../models/GlobalParameters');

// Global parameters cache (for faster access)
let globalParametersCache = null;

/**
 * Simulate grid parameters (in real system, these come from RTU/SCADA)
 */
async function simulateGridParameters() {
  // Simulate grid frequency (oscillates around 50 Hz)
  const gridFrequency = 49.9 + Math.sin(Date.now() / 10000) * 0.5;

  // Simulate grid stress (gradually increases during peak hours)
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();

  // Peak hours: 10 AM - 2 PM, 6 PM - 10 PM
  const isPeakTime =
    (hour >= 10 && hour < 14) || (hour >= 18 && hour < 22);
  const gridStress = isPeakTime ? 0.7 + Math.random() * 0.2 : 0.4 + Math.random() * 0.2;
  const peakFlag = isPeakTime ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.2;

  // Simulate price variation
  const gridPrice = isPeakTime 
    ? 7.0 + Math.random() * 3.0  // Higher during peak
    : 4.0 + Math.random() * 2.0; // Lower during off-peak

  // Power factor oscillates
  const globalPowerFactor = 0.92 + Math.sin(Date.now() / 5000) * 0.05;

  // Save to database
  const params = new GlobalParameters({
    gridFrequency,
    gridStress,
    gridPrice,
    peakFlag,
    globalPowerFactor,
    source: 'SIMULATOR'
  });

  await params.save();
  globalParametersCache = params;
  return params;
}

/**
 * GET /api/dsm/global-params
 * Retrieve current global grid parameters (returns latest from database)
 */
router.get('/global-params', async (req, res) => {
  try {
    // Get latest parameters from database
    let params = await GlobalParameters.findOne().sort({ timestamp: -1 });
    
    if (!params) {
      // If no data in DB, simulate and save
      params = await simulateGridParameters();
    }
    
    res.json({
      gridFrequency: params.gridFrequency,
      gridStress: params.gridStress,
      gridPrice: params.gridPrice,
      peakFlag: params.peakFlag,
      globalPowerFactor: params.globalPowerFactor,
      timestamp: params.timestamp,
      source: params.source
    });
  } catch (error) {
    console.error('❌ Error retrieving global parameters:', error);
    res.status(500).json({ message: 'Failed to retrieve parameters' });
  }
});

/**
 * POST /api/dsm/global-params
 * Manually set global grid parameters (saves to database) - NO AUTHENTICATION REQUIRED
 */
router.post('/global-params', async (req, res) => {
  try {
    console.log('\n' + '═'.repeat(80));
    console.log('🌍 [GLOBAL SERVER] CURL RECEIVED - Global Parameters Update');
    console.log('═'.repeat(80));
    console.log('📥 Received body:', JSON.stringify(req.body, null, 2));
    
    const { gridFrequency, gridStress, gridPrice, peakFlag, globalPowerFactor, notes } = req.body;

    // Validate ranges
    if (gridFrequency !== undefined && (gridFrequency < 49 || gridFrequency > 51)) {
      console.log('❌ Validation failed: gridFrequency out of range (49-51 Hz)');
      return res.status(400).json({ error: 'gridFrequency must be between 49-51 Hz' });
    }

    if (gridStress !== undefined && (gridStress < 0 || gridStress > 1)) {
      console.log('❌ Validation failed: gridStress out of range (0-1)');
      return res.status(400).json({ error: 'gridStress must be between 0-1' });
    }

    if (gridPrice !== undefined && (gridPrice < 0 || gridPrice > 20)) {
      console.log('❌ Validation failed: gridPrice out of range (0-20)');
      return res.status(400).json({ error: 'gridPrice must be between 0-20' });
    }

    if (peakFlag !== undefined && (peakFlag < 0 || peakFlag > 1)) {
      console.log('❌ Validation failed: peakFlag out of range (0-1)');
      return res.status(400).json({ error: 'peakFlag must be between 0-1' });
    }

    if (globalPowerFactor !== undefined && (globalPowerFactor < 0 || globalPowerFactor > 1)) {
      console.log('❌ Validation failed: globalPowerFactor out of range (0-1)');
      return res.status(400).json({ error: 'globalPowerFactor must be between 0-1' });
    }

    console.log('✅ Validation passed');

    // Create new record
    const params = new GlobalParameters({
      gridFrequency: gridFrequency !== undefined ? gridFrequency : 50.0,
      gridStress: gridStress !== undefined ? gridStress : 0.5,
      gridPrice: gridPrice !== undefined ? gridPrice : 5.5,
      peakFlag: peakFlag !== undefined ? peakFlag : 0.5,
      globalPowerFactor: globalPowerFactor !== undefined ? globalPowerFactor : 0.95,
      source: 'MANUAL',
      notes: notes || ''
    });

    await params.save();
    globalParametersCache = params;

    console.log('💾 Global Parameters SAVED to MongoDB:');
    console.log(`   • gridFrequency: ${params.gridFrequency.toFixed(2)} Hz`);
    console.log(`   • gridStress: ${params.gridStress.toFixed(2)}`);
    console.log(`   • gridPrice: ₹${params.gridPrice.toFixed(2)}`);
    console.log(`   • peakFlag: ${params.peakFlag.toFixed(2)}`);
    console.log(`   • globalPowerFactor: ${params.globalPowerFactor.toFixed(3)}`);
    console.log(`   • Timestamp: ${params.timestamp}`);
    console.log(`   • Notes: "${params.notes}"`);
    console.log('═'.repeat(80) + '\n');

    res.json({
      message: 'Global parameters saved to database',
      parameters: {
        gridFrequency: params.gridFrequency,
        gridStress: params.gridStress,
        gridPrice: params.gridPrice,
        peakFlag: params.peakFlag,
        globalPowerFactor: params.globalPowerFactor,
        timestamp: params.timestamp,
        source: params.source
      }
    });
  } catch (error) {
    console.error('❌ Error updating global parameters:', error);
    res.status(500).json({ message: 'Failed to update parameters', error: error.message });
  }
});

/**
 * GET /api/dsm/health
 * Health check for DSM system
 */
router.get('/health', async (req, res) => {
  try {
    const params = await GlobalParameters.findOne().sort({ timestamp: -1 });
    res.json({
      status: 'DSM System OK',
      lastUpdate: params ? params.timestamp : null,
      currentParameters: params ? {
        gridFrequency: params.gridFrequency,
        gridStress: params.gridStress,
        gridPrice: params.gridPrice,
        peakFlag: params.peakFlag,
        globalPowerFactor: params.globalPowerFactor
      } : null
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({ status: 'DSM System Error', error: error.message });
  }
});

module.exports = router;
