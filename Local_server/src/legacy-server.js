const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let espClients = {};
let lastSeen = {};

console.log("🚀 Smart Energy Server Started (Port 8080)");

/* -------- OFFLINE CHECK -------- */
setInterval(() => {

    let now = Date.now();

    Object.keys(lastSeen).forEach((esp) => {

        if (now - lastSeen[esp] > 6000) {

            broadcast({
                type: "status",
                esp: esp,
                status: "OFFLINE"
            });

            console.log("⚠️", esp, "OFFLINE");
        }
    });

}, 3000);


/* -------- CONNECTION -------- */
wss.on('connection', (ws) => {

    console.log("🔌 Client Connected");

    ws.on('message', (msg) => {

        let data;

        try {
            data = JSON.parse(msg);
        } catch {
            console.log("❌ Invalid JSON");
            return;
        }

        console.log("📩 Received:", data);

        /* -------- REGISTER ESP -------- */
        if (data.type === "register") {

            espClients[data.esp] = ws;
            lastSeen[data.esp] = Date.now();

            console.log("✅", data.esp, "ONLINE");

            broadcast({
                type: "status",
                esp: data.esp,
                status: "ONLINE"
            });

            return;
        }

        /* -------- CONTROL FROM WEB -------- */
        if (data.type === "control") {

            if (espClients[data.esp]) {

                espClients[data.esp].send(JSON.stringify(data));

                console.log("🎮 Control sent to", data.esp);

            } else {
                console.log("❌ ESP not connected:", data.esp);
            }

            return;
        }

        /* -------- DATA FROM ESP -------- */
        if (data.type === "data") {

            lastSeen[data.esp] = Date.now();

            data.status = "ONLINE";

            /* ADD EXTRA SERVER-SIDE SAFETY */

            // Prevent abnormal high values
            if (data.current > 10) data.current = 0;
            if (data.voltage > 300) data.voltage = 0;

            // Add server timestamp
            data.time = new Date().toLocaleTimeString();

            broadcast(data);

            console.log("📊 Data:", data.esp);
        }

    });

    ws.on('close', () => {
        console.log("❌ Client Disconnected");
    });

});


/* -------- BROADCAST -------- */
function broadcast(data) {

    wss.clients.forEach(client => {

        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }

    });
}
