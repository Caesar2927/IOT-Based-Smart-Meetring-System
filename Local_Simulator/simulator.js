const WebSocket = require('ws');

// 🔴 Use your PC IP (not localhost if testing with web)
const ws = new WebSocket('ws://10.156.8.130:8080');

let loads = {
  fan: false,
  led: false,
  charger: false,
  laptop: false,
};

// Power values (for simulation)
const POWER = {
  fan: 75,
  led: 10,
  charger: 20,
  laptop: 65,
};

// When connected
ws.on('open', () => {
  console.log("✅ Simulator Connected");

  // 🔥 IMPORTANT: Identify as device
  ws.send(JSON.stringify({ type: "device" }));

  setInterval(() => {

    // Calculate total power
    let totalPower = 0;
    for (let d in loads) {
      if (loads[d]) totalPower += POWER[d];
    }

    let voltage = 230;
    let current = totalPower / voltage;

    const data = {
      type: "data",
      voltage,
      current: parseFloat(current.toFixed(2)),
      power: totalPower,
      loads
    };

    ws.send(JSON.stringify(data));
    console.log("📤 Sent:", data);

  }, 2000);
});

// Receive control command
ws.on('message', (msg) => {
  const cmd = JSON.parse(msg);

  if (cmd.device) {
    loads[cmd.device] = cmd.state;
    console.log(`⚡ ${cmd.device.toUpperCase()} → ${cmd.state ? "ON" : "OFF"}`);
  }
});

// Error handling
ws.on('error', (err) => {
  console.log("❌ Error:", err.message);
});

ws.on('close', () => {
  console.log("🔁 Disconnected");
});