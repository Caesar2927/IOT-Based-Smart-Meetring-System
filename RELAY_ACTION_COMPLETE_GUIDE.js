/**
 * COMPLETE SIGNAL FLOW: From Fuzzy Engine to Physical Load Switching
 * Shows exactly how fuzzy output turns OFF/ON appliances via relay
 */

/**
 * ============================================================================
 * SECTION 1: RELAY ACTION SIGNAL FLOW
 * ============================================================================
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║           FUZZY ENGINE → RELAY CONTROL → PHYSICAL LOAD                    ║
╚════════════════════════════════════════════════════════════════════════════╝

STAGE 1: FUZZY ENGINE DECISION
────────────────────────────────
Input Values:
  Grid Frequency: 49.5 Hz        ← Low (Emergency_Low = 0.85 membership)
  Grid Stress: 0.9               ← High (Critical = 0.95 membership)
  Load Importance: 3             ← Flexible (NOT Essential)
  Load Power: 2500 W             ← Heavy

Fuzzy Rules Activated:
  ✓ Rule 1: gridFreq IS Emergency_Low AND load IS NOT Essential
             → Force_Cut activation = 0.85
  ✓ Rule 2: gridStress IS Critical AND power IS Heavy AND flex IS Flexible
             → Force_Cut activation = 0.80
  
Aggregated Output:
  Keep_On: 0.00
  Moderate_Shed_Risk: 0.05
  Force_Cut: 0.85  ← STRONGEST

Defuzzification (Centroid):
  cutScore = 0.87  ← HIGH score means SHED

Relay Hysteresis:
  cutScore (0.87) > 0.75 threshold
  → relayAction = "OPEN"  ← TURN OFF THE LOAD


STAGE 2: HTTP SERVER PROCESSING
────────────────────────────────
Endpoint: POST /api/dsm/evaluate
Received from client:
{
  "roomId": "room1",
  "appliances": [{
    "applianceId": "AC_001",
    "loadImportance": 3,
    "localPowerFactor": 0.92,
    "loadPower": 2500
  }]
}

DSM Manager actions:
1. Fetch global params: ✓ (gridFreq=49.5, stress=0.9, ...)
2. Evaluate each appliance: ✓ (fuzzyEngine.evaluateLoad())
3. Get evaluation result: ✓ {cutScore: 0.87, relayAction: "OPEN"}
4. Check if relay action needed: ✓ (OPEN ≠ NO_CHANGE)
5. Create relay command:
{
  type: "relay_action",
  applianceId: "AC_001",
  action: "OPEN",           ← THE CRITICAL SIGNAL
  cutScore: 0.87,
  timestamp: 1702305200000
}
6. Send via WebSocket to ESP32: ✓


STAGE 3: WEBSOCKET TRANSMISSION
────────────────────────────────
Local Server (HTTP)
      ↓
      ├─ Get target ESP: espClients["room1"]
      ├─ Check connection: readyState === 1 (OPEN)
      └─ Send JSON:
         {
           "type": "relay_action",
           "applianceId": "AC_001",
           "action": "OPEN",
           "cutScore": 0.87,
           "timestamp": 1702305200000
         }
      ↓
Network (WebSocket protocol)
      ↓
ESP32 (room1.ino)


STAGE 4: ESP32 ARDUINO PROCESSING
──────────────────────────────────
On WebSocket 'message' event:
  
const message = {
  type: 'relay_action',
  applianceId: 'AC_001',
  action: 'OPEN',      ← ESP READS THIS
  cutScore: 0.87
};

if (message.type === 'relay_action') {
  const appId = message.applianceId;
  const relayPin = getRelayPin(appId);  // Fetch GPIO pin for AC_001
  
  if (message.action === 'OPEN') {
    digitalWrite(relayPin, HIGH);       // Set pin HIGH
    Serial.println('🔴 AC_001: RELAY OPENED - LOAD DISCONNECTED');
    updateUI({appId, status: 'OFF'});
    
  } else if (message.action === 'CLOSED') {
    digitalWrite(relayPin, LOW);        // Set pin LOW
    Serial.println('🟢 AC_001: RELAY CLOSED - LOAD CONNECTED');
    updateUI({appId, status: 'ON'});
  }
}


STAGE 5: PHYSICAL CIRCUIT SWITCHING
────────────────────────────────────
Electrical Circuit Before OPEN:
  
  AC Supply (230V) ───[Relay Coil]───[N.O. Contact]─── AC Motor
                    ↑
              digitalWrite(pin, LOW)
              Relay coil: ENERGIZED
              Contact: CLOSED
              Current flows → AC RUNS


Electrical Circuit After OPEN:
  
  AC Supply (230V) ───[Relay Coil]───[N.O. Contact]─── AC Motor
                    ↑
              digitalWrite(pin, HIGH)
              Relay coil: DE-ENERGIZED
              Contact: OPEN (mechanically)
              No current → AC STOPS


RESULT:
  🔴 AC TURNED OFF
  ⚡ 2500W power saved
  ✅ Helps grid recover from frequency drop


STAGE 6: FEEDBACK CYCLE
──────────────────────
ESP32 can send confirmation back:
{
  "type": "ack",
  "applianceId": "AC_001",
  "action": "OPEN",
  "actualStatus": "OFF",
  "timestamp": 1702305200000
}

Server logs: ✅ AC_001 successfully shed
Frontend updates: Shows AC as OFF
Grid monitoring: Frequency starts to recover

╚════════════════════════════════════════════════════════════════════════════╝
`);

/**
 * ============================================================================
 * SECTION 2: RELAY ACTION CODES & MEANINGS
 * ============================================================================
 */

const RelayActions = {
  'OPEN': {
    description: 'Shed the Load - Turn OFF',
    digitalWrite: 'HIGH',
    result: 'Relay contact opens - No current - Load OFF',
    example: 'AC turned off during grid emergency',
    cutScoreTrigger: '> 0.75 (Force_Cut dominant)'
  },
  
  'CLOSED': {
    description: 'Restore the Load - Turn ON',
    digitalWrite: 'LOW',
    result: 'Relay contact closes - Current flows - Load ON',
    example: 'AC turned back on when grid recovers',
    cutScoreTrigger: '< 0.25 (Keep_On dominant)'
  },
  
  'NO_CHANGE': {
    description: 'Maintain Current State (Hysteresis)',
    digitalWrite: 'No change',
    result: 'Relay stays in previous state',
    example: 'AC stays OFF/ON because cutScore is between 0.25-0.75',
    cutScoreTrigger: '0.25 ≤ score ≤ 0.75'
  }
};

console.log('\n' + '='.repeat(80));
console.log('RELAY ACTION MEANINGS');
console.log('='.repeat(80));
Object.entries(RelayActions).forEach(([action, details]) => {
  console.log(`\n${action}:`);
  console.log(`  Description: ${details.description}`);
  console.log(`  digitalWrite: ${details.digitalWrite}`);
  console.log(`  Result: ${details.result}`);
  console.log(`  Example: ${details.example}`);
  console.log(`  Trigger: ${details.cutScoreTrigger}`);
});

/**
 * ============================================================================
 * SECTION 3: PRACTICAL EXAMPLES - DIFFERENT SCENARIOS
 * ============================================================================
 */

console.log('\n' + '='.repeat(80));
console.log('PRACTICAL SCENARIO EXAMPLES');
console.log('='.repeat(80));

// SCENARIO 1: Normal Operation
console.log(`\n${'─'.repeat(80)}`);
console.log('SCENARIO 1: Normal Grid Condition');
console.log('─'.repeat(80));
console.log(`
Grid Status:
  • Frequency: 50.0 Hz ✓ (Normal)
  • Stress: 0.3 (Relaxed)
  • Price: ₹4.0 (Cheap)

Load: AC (importance=3, power=2500W)

Fuzzy Evaluation:
  ✓ Rule 5: gridPrice IS Cheap → Keep_On = 1.0
  Force_Cut = 0.0
  cutScore = 0.15 (Very low)

Relay Action: CLOSED ✓
  digitalWrite(RELAY_PIN, LOW)
  → AC STAYS ON / TURNED ON
  → Grid provides cheap power, use freely
  
Result: 🟢 AC Running normally
`);

// SCENARIO 2: Grid Emergency
console.log(`${'─'.repeat(80)}`);
console.log('SCENARIO 2: Grid Frequency Emergency');
console.log('─'.repeat(80));
console.log(`
Grid Status:
  • Frequency: 49.2 Hz ⚠️ (Emergency!)
  • Stress: 0.95 (Critical)
  • Price: ₹15.0 (Surge)

Load 1: AC (importance=3, power=2500W) - FLEXIBLE
Load 2: Fridge (importance=8, power=800W) - ESSENTIAL

AC Evaluation:
  ✓ Rule 1: Emergency_Freq AND NOT Essential → Force_Cut = 0.85
  cutScore = 0.88
  Relay Action: OPEN
  digitalWrite(RELAY_PIN, HIGH)
  → AC TURNED OFF immediately!
  ✅ Saves 2500W to help grid recover

Fridge Evaluation:
  ✓ Rule 8: Essential AND NOT Emergency → Keep_On = 0.95
  cutScore = 0.20
  Relay Action: CLOSED
  digitalWrite(RELAY_PIN, LOW)
  → Fridge STAYS ON
  ✅ Essential appliance protected

Result: 🔴 AC shed, 🟢 Fridge protected
        Grid frequency recovers: 49.2 → 49.5 → 50.0 Hz
`);

// SCENARIO 3: Expensive Peak Hours
console.log(`${'─'.repeat(80)}`);
console.log('SCENARIO 3: Peak Hours + Surge Pricing');
console.log('─'.repeat(80));
console.log(`
Grid Status:
  • Frequency: 50.0 Hz ✓ (Normal)
  • Stress: 0.6 (Moderate)
  • Price: ₹18.0 (Surge Pricing!)
  • Peak Flag: 0.9 (Peak Hours)

Loads:
  1. TV (importance=2, power=200W) - TRIVIAL
  2. Heater (importance=4, power=2000W) - FLEXIBLE
  3. Light (importance=5, power=100W) - STANDARD

TV Evaluation:
  ✓ Rule 3: Surge_Pricing AND Peak AND Trivial → Force_Cut = 0.9
  cutScore = 0.85
  Relay Action: OPEN
  → TV TURNED OFF (Save money during surge pricing)
  ✅ Reduces cost by ~₹3/hr

Heater Evaluation:
  ✓ Rule 4: Expensive AND Flexible AND Heavy → Moderate = 0.6
  cutScore = 0.55 (In hysteresis zone)
  Relay Action: NO_CHANGE (stays in previous state)
  → If ON, stays ON; If OFF, stays OFF
  ✅ Prevents oscillation

Light Evaluation:
  ✓ Rule 5: (No applicable rule, defaults to moderate)
  cutScore = 0.45 (In hysteresis zone)
  Relay Action: NO_CHANGE
  → Light stays as is
  
Result: 🔴 TV off (save ₹), 🟡 Heater uncertain, 🟢 Light stable
        User can manage based on budget constraints
`);

// SCENARIO 4: Hysteresis Prevention
console.log(`${'─'.repeat(80)}`);
console.log('SCENARIO 4: Hysteresis in Action (Prevents Oscillation)');
console.log('─'.repeat(80));
console.log(`
Situation: Power factor is oscillating between Good and Bad

Time T0:
  globalPowerFactor: 0.88 (Bad) → Rule 6 activates
  cutScore = 0.78
  Relay Action: OPEN
  → Inductive load TURNED OFF
  
Time T1 (10 seconds later):
  globalPowerFactor: 0.89 (slightly better, but still bad)
  Rule would suggest: Force_Cut (0.76)
  
  WITHOUT HYSTERESIS:
    cutScore = 0.76 > 0.75
    Relay Action: OPEN (turn off again)
    → Relay switches on/off every 10 seconds ❌ Wears relay, noise
  
  WITH HYSTERESIS (previousAction = OPEN):
    cutScore = 0.76 (still > 0.75)
    Relay Action: OPEN (stay OFF - continues previous action)
    → Relay remains stable ✅ Smooth operation
  
Time T2 (another 10 seconds):
  globalPowerFactor: 0.92 (Good!)
  cutScore = 0.20 < 0.25
  Relay Action: CLOSED
  → Load TURNED BACK ON
  
  WITHOUT HYSTERESIS:
    Rapid on/off switching ❌
  
  WITH HYSTERESIS:
    Once cutScore goes below 0.25, clear transition ✓
    Relay turns ON cleanly

Result: 🟢 Hysteresis prevents oscillation and protects relay hardware
`);

/**
 * ============================================================================
 * SECTION 5: CUTOFF THRESHOLDS EXPLAINED
 * ============================================================================
 */

console.log('\n' + '='.repeat(80));
console.log('CUTOFF THRESHOLDS & HYSTERESIS DEADBAND');
console.log('='.repeat(80));

console.log(`
cutScore Range: 0.0 to 1.0

┌─────────────────────────────────────────────────────────────────┐
│ cutScore   │ Action        │ Meaning                            │
├─────────────────────────────────────────────────────────────────┤
│ 0.0-0.25   │ CLOSED        │ Definitely keep ON                 │
│ 0.25-0.75  │ NO_CHANGE     │ Maintain current state (hysteresis)│
│ 0.75-1.0   │ OPEN          │ Definitely turn OFF                │
└─────────────────────────────────────────────────────────────────┘

Why two thresholds (0.25 and 0.75)?
  → Creates a DEADBAND to prevent oscillation
  → Once a decision is made, it takes strong opposing force to reverse it
  
Example:
  Load is ON, cutScore oscillates between 0.60-0.70
  → Stays ON (within NO_CHANGE zone)
  → Stable operation ✓
  
  Without deadband, would switch on/off constantly ✗


Hysteresis Implementation:
  function getRelayAction(cutScore, previousAction) {
    if (cutScore > 0.75) {
      return "OPEN";              // Definite OFF
    } else if (cutScore < 0.25) {
      return "CLOSED";            // Definite ON
    } else {
      return previousAction;      // Stay as is (hysteresis)
    }
  }


Real-world analogy:
  Like a thermostat that turns heat ON at 18°C and OFF at 22°C
  (not exactly at 20°C, which would cause constant switching)
`);

/**
 * ============================================================================
 * SECTION 6: COMPLETE REQUEST-RESPONSE EXAMPLE
 * ============================================================================
 */

console.log('\n' + '='.repeat(80));
console.log('COMPLETE API REQUEST-RESPONSE FLOW');
console.log('='.repeat(80));

const completeExample = `
CLIENT (Frontend/App) → LOCAL SERVER (HTTP)

REQUEST:
────────────────────────────────────────────────────────────────

POST /api/dsm/evaluate
Content-Type: application/json

{
  "roomId": "room1",
  "appliances": [
    {
      "applianceId": "AC_001",
      "loadImportance": 3,
      "localPowerFactor": 0.92,
      "loadPower": 2500
    },
    {
      "applianceId": "Fan_001",
      "loadImportance": 2,
      "localPowerFactor": 0.98,
      "loadPower": 500
    },
    {
      "applianceId": "Light_001",
      "loadImportance": 5,
      "localPowerFactor": 1.0,
      "loadPower": 100
    }
  ]
}


PROCESSING (Local Server):
────────────────────────────────────────────────────────────────

1. HTTP Server receives request on port 3000
2. DSM Manager fetches global params from Global Server:
   {
     "gridFrequency": 49.5,
     "gridStress": 0.8,
     "gridPrice": 10.0,
     "peakFlag": 0.7,
     "globalPowerFactor": 0.90
   }
3. For each appliance:
   a. Call fuzzyEngine.evaluateLoad(globalParams, appliance)
   b. Fuzzy engine returns: {cutScore, relayAction, ...}
4. Filter appliances with relayAction !== 'NO_CHANGE'
5. Send WebSocket commands to ESP32 for each shedding decision
6. Build response with all evaluations


RESPONSE:
────────────────────────────────────────────────────────────────

HTTP 200 OK
Content-Type: application/json

{
  "roomId": "room1",
  "evaluations": [
    {
      "applianceId": "AC_001",
      "roomId": "room1",
      "cutScore": 0.82,
      "relayAction": "OPEN",        ← Will be TURNED OFF
      "timestamp": 1702305200000,
      "ruleEvaluations": {
        "Keep_On": 0.05,
        "Moderate_Shed_Risk": 0.13,
        "Force_Cut": 0.82
      }
    },
    {
      "applianceId": "Fan_001",
      "roomId": "room1",
      "cutScore": 0.35,
      "relayAction": "NO_CHANGE",   ← Stays in previous state
      "timestamp": 1702305200000,
      "ruleEvaluations": {
        "Keep_On": 0.30,
        "Moderate_Shed_Risk": 0.35,
        "Force_Cut": 0.35
      }
    },
    {
      "applianceId": "Light_001",
      "roomId": "room1",
      "cutScore": 0.28,
      "relayAction": "CLOSED",      ← Will be/stay TURNED ON
      "timestamp": 1702305200000,
      "ruleEvaluations": {
        "Keep_On": 0.60,
        "Moderate_Shed_Risk": 0.20,
        "Force_Cut": 0.20
      }
    }
  ],
  "message": "Appliances evaluated and relay actions sent"
}


PARALLEL ACTIONS:
────────────────────────────────────────────────────────────────

While HTTP response is being sent, WebSocket commands are 
simultaneously sent to room1 ESP32:

Message 1 to ESP:
{
  "type": "relay_action",
  "applianceId": "AC_001",
  "action": "OPEN",
  "cutScore": 0.82,
  "timestamp": 1702305200000
}
ESP response: digitalWrite(RELAY_PIN_AC, HIGH) → AC OFF ✓

Message 2 to ESP:
(Fan skipped - NO_CHANGE)

Message 3 to ESP:
{
  "type": "relay_action",
  "applianceId": "Light_001",
  "action": "CLOSED",
  "cutScore": 0.28,
  "timestamp": 1702305200000
}
ESP response: digitalWrite(RELAY_PIN_LIGHT, LOW) → Light ON ✓


RESULT:
────────────────────────────────────────────────────────────────

AC:    OFF  (shed 2500W) 🔴
Fan:   (maintained) 🟡
Light: ON   (protected) 🟢

Grid impact: 2500W reduction helps frequency recover
`;

console.log(completeExample);

/**
 * ============================================================================
 * SECTION 7: DEBUGGING & MONITORING
 * ============================================================================
 */

console.log('\n' + '='.repeat(80));
console.log('DEBUGGING: HOW TO MONITOR RELAY ACTIONS');
console.log('='.repeat(80));

const debugTips = `
1. CHECK FUZZY ENGINE OUTPUT:
   GET /api/dsm/history?limit=5
   
   Returns last 5 evaluations with cutScore and relayAction
   Use to verify fuzzy logic is working correctly

2. MONITOR RELAY STATE:
   Local: dsmManager.getRelayState(applianceId)
   Returns: "OPEN" | "CLOSED" | "UNKNOWN"
   
   Verify that relay actions are being tracked

3. WEBSOCKET LOGGING:
   Look for these console messages in ESP32:
   
   "🔴 AC_001: RELAY OPENED - LOAD DISCONNECTED"
   → Confirms OPEN command was received and executed
   
   "🟢 AC_001: RELAY CLOSED - LOAD CONNECTED"
   → Confirms CLOSED command was received and executed

4. VERIFY CUTOFF THRESHOLDS:
   cutScore = 0.82 (> 0.75)  →  Should output: OPEN   ✓
   cutScore = 0.35 (0.25-0.75) → Should output: NO_CHANGE ✓
   cutScore = 0.12 (< 0.25)  →  Should output: CLOSED ✓

5. CHECK ESP PIN STATES:
   Use multimeter on relay coil or read GPIO state
   HIGH = relay de-energized (open contacts) = OPEN action ✓
   LOW = relay energized (closed contacts) = CLOSED action ✓

6. POWER MEASUREMENT:
   Before: AC running = 2500W load
   After relayAction="OPEN": Load disconnected = 0W ✓
   Grid frequency improves as load drops

7. GRID FREQUENCY MONITORING:
   During emergency (49.5 Hz):
     → Shed loads (AC OFF, 2500W drop)
     → Frequency recovers (49.5 → 49.8 → 50.0 Hz)
     → Once recovered, restore loads
   
   Verify this feedback loop is working

8. TEST CASES:
   
   Test 1: Force_Cut scenario
     Set gridFrequency = 49.0 (Emergency)
     Expected: AC should turn OFF (relayAction = OPEN)
     
   Test 2: Keep_On scenario
     Set gridPrice = 2.0 (Cheap)
     Expected: AC should stay ON (relayAction = CLOSED)
     
   Test 3: Hysteresis test
     Set cutScore oscillating between 0.60-0.70
     Expected: relayAction = NO_CHANGE (prevents switching)
`;

console.log(debugTips);

console.log('\n' + '='.repeat(80));
console.log('END OF RELAY CONTROL DOCUMENTATION');
console.log('='.repeat(80));
