/**
 * ============================================================================
 * DSM COMPLETE TESTING GUIDE - LOGS & CURL COMMANDS
 * ============================================================================
 * 
 * This guide shows exactly what logs you'll see at each step when testing DSM
 */

/**
 * STEP 1: SET GLOBAL PARAMETERS (In GLOBAL SERVER terminal)
 * ============================================================================
 */

console.log(`

╔════════════════════════════════════════════════════════════════════════════╗
║                              STEP 1: GLOBAL SERVER                         ║
║                        Send Global Parameters via CURL                     ║
╚════════════════════════════════════════════════════════════════════════════╝

RUN THIS CURL COMMAND:
─────────────────────────────────────────────────────────────────────────────
curl -X POST http://localhost:5000/api/dsm/global-params \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \\
  -d '{
    "gridFrequency": 49.2,
    "gridStress": 0.95,
    "gridPrice": 15.0,
    "peakFlag": 1.0,
    "globalPowerFactor": 0.80,
    "notes": "Grid emergency - frequency dropping"
  }'
─────────────────────────────────────────────────────────────────────────────

YOU WILL SEE IN GLOBAL SERVER CONSOLE:
─────────────────────────────────────────────────────────────────────────────

════════════════════════════════════════════════════════════════════════════
🌍 [GLOBAL SERVER] CURL RECEIVED - Global Parameters Update
════════════════════════════════════════════════════════════════════════════
📥 Received body: {
  "gridFrequency": 49.2,
  "gridStress": 0.95,
  "gridPrice": 15.0,
  "peakFlag": 1.0,
  "globalPowerFactor": 0.8,
  "notes": "Grid emergency - frequency dropping"
}
✅ Validation passed
💾 Global Parameters SAVED to MongoDB:
   • gridFrequency: 49.20 Hz
   • gridStress: 0.95
   • gridPrice: ₹15.00
   • peakFlag: 1.00
   • globalPowerFactor: 0.800
   • Timestamp: 2026-04-16T10:30:45.123Z
   • Notes: "Grid emergency - frequency dropping"
════════════════════════════════════════════════════════════════════════════

RESPONSE BODY (from curl):
{
  "message": "Global parameters saved to database",
  "parameters": {
    "gridFrequency": 49.2,
    "gridStress": 0.95,
    "gridPrice": 15,
    "peakFlag": 1,
    "globalPowerFactor": 0.8,
    "timestamp": "2026-04-16T10:30:45.123Z",
    "source": "MANUAL"
  }
}

`);

/**
 * STEP 2: LOCAL SERVER AUTOMATIC FETCH (Every 10 seconds)
 * ============================================================================
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                         STEP 2: LOCAL SERVER FETCH                         ║
║                    Automatic every 10 seconds (NO ACTION NEEDED)           ║
╚════════════════════════════════════════════════════════════════════════════╝

LOCAL SERVER AUTOMATICALLY FETCHES EVERY 10 SECONDS:

YOU WILL SEE IN LOCAL SERVER CONSOLE (Auto-triggered):
─────────────────────────────────────────────────────────────────────────────

════════════════════════════════════════════════════════════════════════════
🔍 [LOCAL SERVER] FETCHED Global Parameters (Every 10 seconds)
════════════════════════════════════════════════════════════════════════════
📡 From Global Server: http://localhost:5000
🌍 Global Variables RECEIVED:
   • gridFrequency: 49.20 Hz
   • gridStress: 0.95
   • gridPrice: ₹15.00
   • peakFlag: 1.00
   • globalPowerFactor: 0.800
   • Timestamp: 2026-04-16T10:30:45.123Z (10:30:45 AM)
   • Source: MANUAL
════════════════════════════════════════════════════════════════════════════

✅ Global parameters are now cached in Local Server
✅ Ready for appliance evaluation

`);

/**
 * STEP 3: SEND ROOM DATA WITH LOCAL VARIABLES
 * ============================================================================
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                        STEP 3: SEND ROOM DATA                              ║
║              Feed Local Variables (Appliance Data) to DSM                  ║
╚════════════════════════════════════════════════════════════════════════════╝

RUN THIS CURL COMMAND (From your Frontend/Client):
─────────────────────────────────────────────────────────────────────────────
curl -X POST http://localhost:3000/api/dsm/evaluate \\
  -H "Content-Type: application/json" \\
  -d '{
    "roomId": "room1",
    "appliances": [
      {
        "applianceId": "AC_001",
        "loadImportance": 3,
        "localPowerFactor": 0.92,
        "loadPower": 2500
      },
      {
        "applianceId": "Fridge_001",
        "loadImportance": 8,
        "localPowerFactor": 0.98,
        "loadPower": 800
      },
      {
        "applianceId": "Light_001",
        "loadImportance": 5,
        "localPowerFactor": 1.0,
        "loadPower": 100
      }
    ]
  }'
─────────────────────────────────────────────────────────────────────────────

YOU WILL SEE IN LOCAL SERVER CONSOLE:
─────────────────────────────────────────────────────────────────────────────

▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
💻 [LOCAL SERVER] HTTP Request RECEIVED - /api/dsm/evaluate
▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼
📨 Request Body:
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
      "applianceId": "Fridge_001",
      "loadImportance": 8,
      "localPowerFactor": 0.98,
      "loadPower": 800
    },
    {
      "applianceId": "Light_001",
      "loadImportance": 5,
      "localPowerFactor": 1,
      "loadPower": 100
    }
  ]
}

╔══════════════════════════════════════════════════════════════════════════╗
║                    🏠 ROOM EVALUATION CYCLE 🏠                           ║
╚══════════════════════════════════════════════════════════════════════════╝

📥 Room Data RECEIVED: room1
   Appliances count: 3
   1. AC_001 (Importance: 3, Power: 2500W)
   2. Fridge_001 (Importance: 8, Power: 800W)
   3. Light_001 (Importance: 5, Power: 100W)

──────────────────────────────────────────────────────────────────────────
📊 [DSM EVALUATION] Fuzzy Engine Processing
──────────────────────────────────────────────────────────────────────────
🏠 Room: room1
⚡ Appliance: AC_001

🌍 GLOBAL VARIABLES (From Grid/Global Server):
   • gridFrequency: 49.20 Hz
   • gridStress: 0.95
   • gridPrice: ₹15.00
   • peakFlag: 1.00
   • globalPowerFactor: 0.800

🏘️ LOCAL VARIABLES (From Room/Appliance):
   • loadImportance: 3
   • loadPower: 2500 W
   • localPowerFactor: 0.920
   • previousRelayState: NONE

🎯 FUZZY ENGINE OUTPUT:
   • cutScore: 0.887 (0.0-1.0)
   • relayAction: OPEN
   • Rule Activations:
     - Keep_On: 0.050
     - Moderate_Shed_Risk: 0.130
     - Force_Cut: 0.887

✅ RELAY ACTION: 🔴 TURN OFF

──────────────────────────────────────────────────────────────────────────

──────────────────────────────────────────────────────────────────────────
📊 [DSM EVALUATION] Fuzzy Engine Processing
──────────────────────────────────────────────────────────────────────────
🏠 Room: room1
⚡ Appliance: Fridge_001

🌍 GLOBAL VARIABLES (From Grid/Global Server):
   • gridFrequency: 49.20 Hz
   • gridStress: 0.95
   • gridPrice: ₹15.00
   • peakFlag: 1.00
   • globalPowerFactor: 0.800

🏘️ LOCAL VARIABLES (From Room/Appliance):
   • loadImportance: 8
   • loadPower: 800 W
   • localPowerFactor: 0.980
   • previousRelayState: NONE

🎯 FUZZY ENGINE OUTPUT:
   • cutScore: 0.195 (0.0-1.0)
   • relayAction: CLOSED
   • Rule Activations:
     - Keep_On: 0.850  ← RULE 8 ACTIVATED (Essential load!)
     - Moderate_Shed_Risk: 0.100
     - Force_Cut: 0.050

✅ RELAY ACTION: 🟢 TURN ON

──────────────────────────────────────────────────────────────────────────

──────────────────────────────────────────────────────────────────────────
📊 [DSM EVALUATION] Fuzzy Engine Processing
──────────────────────────────────────────────────────────────────────────
🏠 Room: room1
⚡ Appliance: Light_001

🌍 GLOBAL VARIABLES (From Grid/Global Server):
   • gridFrequency: 49.20 Hz
   • gridStress: 0.95
   • gridPrice: ₹15.00
   • peakFlag: 1.00
   • globalPowerFactor: 0.800

🏘️ LOCAL VARIABLES (From Room/Appliance):
   • loadImportance: 5
   • loadPower: 100 W
   • localPowerFactor: 1.000
   • previousRelayState: NONE

🎯 FUZZY ENGINE OUTPUT:
   • cutScore: 0.620 (0.0-1.0)
   • relayAction: NO_CHANGE
   • Rule Activations:
     - Keep_On: 0.420
     - Moderate_Shed_Risk: 0.620
     - Force_Cut: 0.200

⚪ RELAY ACTION: MAINTAIN CURRENT STATE (Hysteresis)

──────────────────────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════════════════════════╗
║           📊 ROOM EVALUATION SUMMARY - room1                             ║
╚══════════════════════════════════════════════════════════════════════════╝
🔴 AC_001               | cutScore: 0.887 | OPEN
🟢 Fridge_001          | cutScore: 0.195 | CLOSED
⚪ Light_001           | cutScore: 0.620 | NO_CHANGE
════════════════════════════════════════════════════════════════════════════

✅ Evaluation Complete - Response sent to client
════════════════════════════════════════════════════════════════════════════

`);

/**
 * STEP 4: RESPONSE RECEIVED BY CLIENT
 * ============================================================================
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                     STEP 4: RESPONSE FROM LOCAL SERVER                     ║
║                     Client receives evaluation results                      ║
╚════════════════════════════════════════════════════════════════════════════╝

RESPONSE BODY (from curl -X POST /api/dsm/evaluate):
─────────────────────────────────────────────────────────────────────────────
{
  "roomId": "room1",
  "evaluations": [
    {
      "applianceId": "AC_001",
      "roomId": "room1",
      "cutScore": 0.887,
      "relayAction": "OPEN",        ← 🔴 TURN OFF
      "timestamp": 1713269445123,
      "ruleEvaluations": {
        "Keep_On": 0.05,
        "Moderate_Shed_Risk": 0.13,
        "Force_Cut": 0.887
      }
    },
    {
      "applianceId": "Fridge_001",
      "roomId": "room1",
      "cutScore": 0.195,
      "relayAction": "CLOSED",      ← 🟢 TURN ON
      "timestamp": 1713269445123,
      "ruleEvaluations": {
        "Keep_On": 0.85,
        "Moderate_Shed_Risk": 0.1,
        "Force_Cut": 0.05
      }
    },
    {
      "applianceId": "Light_001",
      "roomId": "room1",
      "cutScore": 0.62,
      "relayAction": "NO_CHANGE",   ← ⚪ MAINTAIN STATE
      "timestamp": 1713269445123,
      "ruleEvaluations": {
        "Keep_On": 0.42,
        "Moderate_Shed_Risk": 0.62,
        "Force_Cut": 0.2
      }
    }
  ],
  "message": "Appliances evaluated and relay actions sent"
}

ACTIONS TAKEN:
✅ AC (cutScore 0.887 > 0.75) → RELAY OPENED → Power disconnected → AC turns OFF
✅ Fridge (cutScore 0.195 < 0.25) → RELAY CLOSED → Power connected → Fridge stays ON
✅ Light (cutScore 0.62 in hysteresis zone) → NO action → Stays as previous state

RESULT:
🔴 AC SHED        (Saves 2500W for grid recovery)
🟢 Fridge SAVED   (Essential appliance protected)
⚪ Light STABLE   (In hysteresis deadband)

Grid emergency help: 2500W load removed helps frequency recover from 49.2 → 49.5 → 50.0 Hz

`);

/**
 * COMPLETE SEQUENCE SUMMARY
 * ============================================================================
 */

console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    COMPLETE SEQUENCE SUMMARY                               ║
╚════════════════════════════════════════════════════════════════════════════╝

1️⃣  GLOBAL SERVER RECEIVES CURL
    └─ POST /api/dsm/global-params
    └─ Logs: "[GLOBAL SERVER] CURL RECEIVED"
    └─ Validates data
    └─ Saves to MongoDB
    └─ Returns response

2️⃣  LOCAL SERVER AUTO-FETCHES EVERY 10 SECONDS
    └─ GET /api/dsm/global-params (from Global Server)
    └─ Logs: "[LOCAL SERVER] FETCHED Global Parameters"
    └─ Caches in memory for evaluations
    └─ No manual action needed

3️⃣  CLIENT SENDS ROOM DATA
    └─ POST /api/dsm/evaluate
    └─ Includes appliances with loadImportance, loadPower, etc.
    └─ Logs: "[LOCAL SERVER] HTTP Request RECEIVED"
    └─ Logs: "Room Data RECEIVED"

4️⃣  FOR EACH APPLIANCE: FUZZY ENGINE EVALUATES
    └─ Takes Global Variables (from Step 2)
    └─ Takes Local Variables (from Step 3)
    └─ Logs: "[DSM EVALUATION] Fuzzy Engine Processing"
    └─ Shows all inputs
    └─ Calculates cutScore
    └─ Determines relayAction

5️⃣  RELAY ACTIONS SENT TO ESP32
    └─ WebSocket message to room's ESP
    └─ digitalWrite(pin, HIGH/LOW)
    └─ Load turns OFF/ON

6️⃣  RESPONSE RETURNED TO CLIENT
    └─ All evaluations with cutScores and actions
    └─ Client can display results to user
    └─ Can log to database for analytics

═════════════════════════════════════════════════════════════════════════════

KEY METRICS TO MONITOR:

gridFrequency < 49.5  → CRITICAL (Emergency shedding)
gridStress > 0.85     → AGGRESSIVE (Shed flexible loads)
gridPrice > 11.0      → SURGE PRICING (Shed non-essential)
peakFlag > 0.8        → PEAK HOURS (Consider shedding)

loadImportance 1-3    → Trivial (Can shed anytime)
loadImportance 4-7    → Flexible (Shed if necessary)
loadImportance 8-10   → Essential (Never shed unless emergency)

cutScore > 0.75       → OPEN (Turn OFF)
cutScore < 0.25       → CLOSED (Turn ON)
0.25 ≤ cutScore ≤ 0.75 → NO_CHANGE (Hysteresis prevents oscillation)

═════════════════════════════════════════════════════════════════════════════
`);
