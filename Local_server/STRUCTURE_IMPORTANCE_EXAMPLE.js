/**
 * STRUCTURE.JS UPDATED - Room Importance Integration Example
 * 
 * This file demonstrates how the updated Structure model now includes
 * room importance levels that get passed to the Fuzzy Engine.
 */

/**
 * ============================================================================
 * PART 1: SAVING ROOM STRUCTURE WITH IMPORTANCE
 * ============================================================================
 */

// Before: Structure model only stored number of switches
// const oldStructure = {
//   numRooms: 3,
//   rooms: {
//     room1: 2,  // Just number of switches
//     room2: 3,
//     room3: 1
//   }
// };

// NOW: Structure model stores room details including importance
const newStructure = {
  numRooms: 3,
  rooms: {
    room1: {
      numberOfSwitches: 2,
      importance: 3  // Default value - Flexible importance (can shed non-essential loads)
    },
    room2: {
      numberOfSwitches: 3,
      importance: 3  // Default - can also shed if needed
    },
    room3: {
      numberOfSwitches: 1,
      importance: 3  // Default
    }
  }
};

// Example: Create/Update structure with custom importance for some rooms
const customStructure = {
  numRooms: 4,
  rooms: {
    room1: {  // Living room
      numberOfSwitches: 4,
      importance: 2  // Lower importance - TV, fan, lights are flexible
    },
    room2: {  // Bedroom
      numberOfSwitches: 3,
      importance: 3  // Default - standard importance
    },
    room3: {  // Kitchen
      numberOfSwitches: 5,
      importance: 4  // Higher importance - refrigerator, stove are important
    },
    room4: {  // Medical room / ICU setup
      numberOfSwitches: 2,
      importance: 9  // Very high importance - medical equipment critical
    }
  }
};

/**
 * ============================================================================
 * PART 2: DATABASE OPERATIONS WITH STRUCTURE
 * ============================================================================
 */

const Structure = require('./models/Structure');

// CREATE new structure
async function createStructure() {
  try {
    const structure = new Structure({
      numRooms: 3,
      rooms: new Map([
        ['room1', { numberOfSwitches: 2, importance: 3 }],
        ['room2', { numberOfSwitches: 3, importance: 3 }],
        ['room3', { numberOfSwitches: 1, importance: 3 }]
      ])
    });

    await structure.save();
    console.log('✅ Structure saved with default importance = 3 for all rooms');
    return structure;
  } catch (error) {
    console.error('❌ Error saving structure:', error);
  }
}

// UPDATE structure with custom importance
async function updateRoomImportance(roomId, importance) {
  try {
    const structure = await Structure.findOne();
    if (!structure) {
      throw new Error('Structure not found');
    }

    const roomDetail = structure.rooms.get(roomId);
    if (roomDetail) {
      roomDetail.importance = importance;
      await structure.save();
      console.log(`✅ Updated ${roomId} importance to ${importance}`);
    }
  } catch (error) {
    console.error('❌ Error updating importance:', error);
  }
}

// READ structure and extract room importance
async function getRoomImportance(roomId) {
  try {
    const structure = await Structure.findOne();
    const roomDetail = structure.rooms.get(roomId);
    
    if (roomDetail) {
      console.log(`Room: ${roomId}, Switches: ${roomDetail.numberOfSwitches}, Importance: ${roomDetail.importance}`);
      return roomDetail.importance;
    }
  } catch (error) {
    console.error('❌ Error reading structure:', error);
  }
}

/**
 * ============================================================================
 * PART 3: HOW ROOM IMPORTANCE FLOWS TO FUZZY ENGINE
 * ============================================================================
 */

const dsmManager = require('./services/dsmManager');
const Structure = require('./models/Structure');

/**
 * WORKFLOW: Evaluate appliances with room-based default importance
 * 
 * Step 1: Get structure from database
 * Step 2: Get appliance data from ESP/WebSocket
 * Step 3: Add room's default importance to each appliance
 * Step 4: Pass to Fuzzy Engine for evaluation
 */

async function evaluateRoomAppliances(roomId, applianceData) {
  try {
    // Step 1: Get structure with room importance
    const structure = await Structure.findOne();
    const roomDetail = structure.rooms.get(roomId);
    
    if (!roomDetail) {
      throw new Error(`Room ${roomId} not found in structure`);
    }

    console.log(`\n📍 Evaluating room: ${roomId}`);
    console.log(`   Default Importance: ${roomDetail.importance}`);
    console.log(`   Number of Switches: ${roomDetail.numberOfSwitches}`);

    // Step 2: Get appliance data from ESP
    // Example applianceData from WebSocket:
    const appliances = [
      {
        applianceId: 'AC_001',
        localPowerFactor: 0.92,
        loadPower: 2500
        // Note: loadImportance NOT provided by appliance yet
      },
      {
        applianceId: 'Fan_001',
        localPowerFactor: 0.98,
        loadPower: 500
      }
    ];

    // Step 3: Add room importance to each appliance
    const enrichedAppliances = appliances.map(appliance => ({
      ...appliance,
      roomId,
      loadImportance: roomDetail.importance  // ← Use room's default importance
    }));

    console.log('\n📊 Enriched appliance data:');
    enrichedAppliances.forEach(app => {
      console.log(`   ${app.applianceId}: importance=${app.loadImportance}, power=${app.loadPower}W`);
    });

    // Step 4: Evaluate using DSM Manager (which calls Fuzzy Engine)
    const evaluations = dsmManager.evaluateRoom(roomId, enrichedAppliances);

    console.log('\n✅ Fuzzy Engine Evaluations:');
    evaluations.forEach(eval => {
      console.log(`   ${eval.applianceId}:`);
      console.log(`      Cut Score: ${eval.cutScore.toFixed(2)}`);
      console.log(`      Relay Action: ${eval.relayAction}`);
      console.log(`      Force_Cut: ${eval.ruleEvaluations.Force_Cut.toFixed(2)}`);
    });

    return evaluations;

  } catch (error) {
    console.error('❌ Error evaluating room:', error.message);
  }
}

/**
 * ============================================================================
 * PART 4: REAL-WORLD SCENARIO EXAMPLE
 * ============================================================================
 */

/**
 * SCENARIO: Smart Home with 4 rooms
 * - Room 1 (Living Room): Flexible loads → importance: 2
 * - Room 2 (Bedroom): Standard loads → importance: 3
 * - Room 3 (Kitchen): Important loads → importance: 5
 * - Room 4 (Medical): Critical loads → importance: 8
 * 
 * GRID CONDITION: Moderate stress (freq=49.8, stress=0.7, price=8.0)
 * Expected behavior: Shed flexible loads first, protect important loads
 */

async function demonstrateImportanceBasedShedding() {
  const gridCondition = {
    gridFrequency: 49.8,      // Low - some stress
    gridStress: 0.7,          // Moderate stress
    gridPrice: 8.0,           // Standard-Expensive
    peakFlag: 0.5,            // Normal hours
    globalPowerFactor: 0.92   // Acceptable
  };

  console.log('\n' + '='.repeat(80));
  console.log('SCENARIO: Room-Based Importance in Load Shedding');
  console.log('='.repeat(80));
  console.log('\nGRID CONDITION:');
  console.log(`  Frequency: ${gridCondition.gridFrequency} Hz (Low)`);
  console.log(`  Stress: ${gridCondition.gridStress} (Moderate)`);
  console.log(`  Price: ₹${gridCondition.gridPrice} (Standard-Expensive)`);

  const fuzzyEngine = require('./services/fuzzyEngine');

  // Room 1: Living Room (importance: 2 - FLEXIBLE)
  console.log('\n' + '-'.repeat(80));
  console.log('ROOM 1: Living Room (Importance: 2 - FLEXIBLE)');
  console.log('-'.repeat(80));

  const livingRoomAppliances = [
    {
      applianceId: 'TV_001',
      roomId: 'room1',
      loadImportance: 2,        // Flexible
      loadPower: 200,
      localPowerFactor: 0.95
    },
    {
      applianceId: 'Fan_001',
      roomId: 'room1',
      loadImportance: 2,        // Flexible
      loadPower: 300,
      localPowerFactor: 0.98
    }
  ];

  livingRoomAppliances.forEach(app => {
    const result = fuzzyEngine.evaluateLoad(gridCondition, app);
    console.log(`\n${app.applianceId} (${app.loadPower}W, importance=${app.loadImportance}):`);
    console.log(`  Cut Score: ${result.cutScore.toFixed(2)}`);
    console.log(`  Relay Action: ${result.relayAction}`);
    console.log(`  → ${result.relayAction === 'OPEN' ? '🔴 WILL BE SHED' : '🟢 WILL STAY ON'}`);
  });

  // Room 3: Kitchen (importance: 5 - IMPORTANT)
  console.log('\n' + '-'.repeat(80));
  console.log('ROOM 3: Kitchen (Importance: 5 - IMPORTANT)');
  console.log('-'.repeat(80));

  const kitchenAppliances = [
    {
      applianceId: 'Fridge_001',
      roomId: 'room3',
      loadImportance: 5,        // Important
      loadPower: 800,
      localPowerFactor: 0.95
    },
    {
      applianceId: 'Oven_001',
      roomId: 'room3',
      loadImportance: 5,        // Important
      loadPower: 2000,
      localPowerFactor: 0.92
    }
  ];

  kitchenAppliances.forEach(app => {
    const result = fuzzyEngine.evaluateLoad(gridCondition, app);
    console.log(`\n${app.applianceId} (${app.loadPower}W, importance=${app.loadImportance}):`);
    console.log(`  Cut Score: ${result.cutScore.toFixed(2)}`);
    console.log(`  Relay Action: ${result.relayAction}`);
    console.log(`  → ${result.relayAction === 'OPEN' ? '🔴 SHED (if necessary)' : '🟢 PROTECTED'}`);
  });

  // Room 4: Medical (importance: 8 - CRITICAL)
  console.log('\n' + '-'.repeat(80));
  console.log('ROOM 4: Medical Room (Importance: 8 - CRITICAL)');
  console.log('-'.repeat(80));

  const medicalAppliances = [
    {
      applianceId: 'Monitor_001',
      roomId: 'room4',
      loadImportance: 8,        // Critical
      loadPower: 150,
      localPowerFactor: 0.99
    },
    {
      applianceId: 'Ventilator_001',
      roomId: 'room4',
      loadImportance: 8,        // Critical
      loadPower: 500,
      localPowerFactor: 0.95
    }
  ];

  medicalAppliances.forEach(app => {
    const result = fuzzyEngine.evaluateLoad(gridCondition, app);
    console.log(`\n${app.applianceId} (${app.loadPower}W, importance=${app.loadImportance}):`);
    console.log(`  Cut Score: ${result.cutScore.toFixed(2)}`);
    console.log(`  Relay Action: ${result.relayAction}`);
    console.log(`  → ${result.relayAction === 'OPEN' ? '🔴 NOT PROTECTED!' : '🟢 ALWAYS PROTECTED'}`);
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY:');
  console.log('='.repeat(80));
  console.log('Priority of shedding:');
  console.log('  1. Living Room (importance: 2) → Most likely to be shed');
  console.log('  2. Kitchen (importance: 5) → Shed only if critical');
  console.log('  3. Medical (importance: 8) → Never shed unless absolute emergency');
  console.log('\nThis ensures critical services are protected first during grid stress!\n');
}

/**
 * ============================================================================
 * PART 5: DYNAMIC IMPORTANCE UPDATE
 * ============================================================================
 */

/**
 * Use case: Administrator wants to change room importance
 * E.g., During blackout, make kitchen importance = 2 (reduce shedding priority)
 *       After blackout, restore to normal importance = 5
 */

async function dynamicImportanceScenario() {
  console.log('\n' + '='.repeat(80));
  console.log('DYNAMIC IMPORTANCE UPDATE SCENARIO');
  console.log('='.repeat(80));

  try {
    // Normal operation
    console.log('\n📌 Normal Operation:');
    console.log('  Kitchen importance: 5 (Protected - refrigerator is important)');
    
    // Grid emergency
    console.log('\n⚠️ Grid Emergency:');
    console.log('  Admin reduces kitchen importance to 2 (Can shed if needed)');
    await updateRoomImportance('room3', 2);

    // Grid recovers
    console.log('\n✅ Grid Recovered:');
    console.log('  Admin restores kitchen importance to 5');
    await updateRoomImportance('room3', 5);

  } catch (error) {
    console.error('Error in dynamic scenario:', error);
  }
}

/**
 * ============================================================================
 * PART 6: MONITORING & LOGGING
 * ============================================================================
 */

/**
 * Monitor what importance level is being used for each room
 */
async function monitorRoomImportance() {
  try {
    const structure = await Structure.findOne();
    
    console.log('\n' + '='.repeat(80));
    console.log('CURRENT ROOM IMPORTANCE LEVELS');
    console.log('='.repeat(80));
    console.log(`Total Rooms: ${structure.numRooms}\n`);

    structure.rooms.forEach((roomDetail, roomId) => {
      const importanceLevel = {
        1: '⚠️ Trivial (Will be shed first)',
        2: '🟡 Low (Flexible)',
        3: '🟢 Medium (Standard - DEFAULT)',
        4: '🔵 High (Important)',
        5: '🔵 High (Important)',
        6: '🟣 Very High (Critical)',
        7: '🟣 Very High (Critical)',
        8: '🔴 Maximum (Essential)',
        9: '🔴 Maximum (Essential)',
        10: '🔴 Maximum (Essential)'
      };

      console.log(`Room: ${roomId}`);
      console.log(`  Switches: ${roomDetail.numberOfSwitches}`);
      console.log(`  Importance: ${roomDetail.importance}/10 - ${importanceLevel[roomDetail.importance]}`);
      console.log();
    });

  } catch (error) {
    console.error('Error monitoring importance:', error);
  }
}

/**
 * ============================================================================
 * EXPORTS
 * ============================================================================
 */

module.exports = {
  createStructure,
  updateRoomImportance,
  getRoomImportance,
  evaluateRoomAppliances,
  demonstrateImportanceBasedShedding,
  dynamicImportanceScenario,
  monitorRoomImportance
};

// Run example if executed directly
if (require.main === module) {
  (async () => {
    // Uncomment to run examples:
    // await demonstrateImportanceBasedShedding();
    // await monitorRoomImportance();
    // await dynamicImportanceScenario();
  })();
}
