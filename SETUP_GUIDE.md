# IoT Smart Metering System — Setup & Integration Guide

This guide walks you through setting up and running the complete IoT Smart Metering System with Global Server, Local Server, ESP32, and Frontend.

## Architecture Overview

```
┌─────────────┐                      ┌──────────────────┐
│   ESP32     │                      │   Global Server  │
│ room1/room2 │────WebSocket────────→│  (MongoDB, JWT)  │
│  (Arduino)  │   (port 8080)        │  Node.js Express │
└─────────────┘                      └──────────────────┘
      ↑                                      ↑
      │                                      │
      │  HTTP REST                           │ HTTP REST
      │  (port 3000)                         │ (port 5000)
      │                                      │
      └──────────────────┬───────────────────┘
                         │
                    ┌────v─────┐
                    │ Frontend  │
                    │ (JS/HTML) │
                    └──────────┘

Flow:
1. ESP32 sends data every 2 seconds via WebSocket to Local Server
2. Local Server caches and broadcasts to Frontend
3. Local Server pushes to Global Server every 5 seconds
4. Global Server stores live stats and calculates daily billing at midnight
5. Global Server scrapes IEX India tariff data every 15 minutes
```

## Prerequisites

- **Node.js** 14+ (download from nodejs.org)
- **MongoDB** (local or MongoDB Atlas)
- **Python 3** (for ESP32 development)
- **Visual Studio Code** + PlatformIO extension (for ESP32 firmware)
- **Chromium/Chrome** (for Puppeteer web scraping)

## Step 1: MongoDB Setup

### Option A: Local MongoDB

```bash
# Windows
# Download from https://www.mongodb.com/try/download/community
# Install and ensure mongod service is running

# Verify connection
mongosh mongodb://localhost:27017
```

### Option B: MongoDB Atlas (Cloud)

1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Get connection string: `mongodb+srv://user:password@cluster.mongodb.net/smart_metering`
5. Use this as `MONGODB_URI` in `.env` files

**Recommended Connection String:**
```
mongodb://localhost:27017/smart_metering
```

## Step 2: Global Server Setup

### 2.1 Install Dependencies

```bash
cd Global_server
npm install
```

### 2.2 Configure Environment

Update or create `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smart_metering
JWT_SECRET=change_this_to_a_random_string_min_32_chars
JWT_EXPIRES_IN=7d
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://192.168.1.10:3000,http://192.168.1.10:8080
```

**Generate Secure JWT_SECRET:**
```bash
# macOS/Linux/PowerShell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 Start Global Server

```bash
npm start
# Expected output:
# [MongoDB] Connecting to mongodb://localhost:27017/smart_metering
# [MongoDB] Connected successfully
# [Express] Server running on port 5000
# [IEX Scraper] Running initial scrape...
# [Cron] Scheduled IEX Scraper to run every 15 minutes
```

## Step 3: User Registration

### Create Global Server Account

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Home Owner",
    "email": "home@example.com",
    "password": "securepassword123",
    "localServerURL": "http://192.168.1.10:3000"
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { "id": "...", "name": "Home Owner", "localServerURL": "http://192.168.1.10:3000" }
# }
```

**Save the returned JWT token** — you'll need it for the Local Server!

## Step 4: Local Server Setup

### 4.1 Install Dependencies

```bash
cd Local_server
npm install
```

### 4.2 Configure Environment

Create `.env` (copy from `.env.example`):

```env
MONGODB_URI=mongodb://localhost:27017/smart_metering
WS_PORT=8080
HTTP_PORT=3000
GLOBAL_SERVER_URL=http://localhost:5000
USER_JWT=<paste_the_jwt_token_from_step_3>
NODE_ENV=development
```

### 4.3 Start Local Server

```bash
npm start
# Expected output:
# 🚀 WebSocket server listening on port 8080
# ⏰ Started periodic data saving (every 5 seconds)
# 💳 Billing manager initialized with midnight cron
# 🌐 HTTP control server running on port 3000
# ✅ Smart Energy Services running (WS: 8080, HTTP: 3000)
```

## Step 5: Local Simulator (for Testing without Hardware)

### 5.1 Start Simulator

```bash
cd Local_Simulator
node simulator.js
# Expected output:
# Connecting to ws://localhost:8080
# room1 connected!
# room2 connected!
# [periodic sensor data messages...]
```

The simulator will:
- Connect room1 and room2 to Local Server
- Send simulated sensor readings every 2 seconds
- Simulate realistic electrical parameters

## Step 6: Frontend Setup

### 6.1 Update Frontend Configuration

Edit `Frontend/index.html`:

```javascript
// In your JavaScript, set:
const GLOBAL_SERVER_URL = 'http://localhost:5000';
const LOCAL_SERVER_WS_URL = 'ws://192.168.1.10:8080'; // From JWT after login
```

### 6.2 Frontend Login Flow

```javascript
1. User enters email/password
2. POST to http://localhost:5000/api/auth/login
3. Receive JWT and extract localServerURL
4. Connect WebSocket to ws://localServerURL:8080
5. Request live stats from Global Server or Local Server

// Example:
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { token, user } = await response.json();
localStorage.setItem('globalJWT', token);
localStorage.setItem('localServerURL', user.localServerURL);

// Connect to local WebSocket for real-time data
const ws = new WebSocket(`ws://${user.localServerURL}:8080`);
```

## Step 7: Real ESP32 Firmware (Optional)

### 7.1 Arduino IDE / PlatformIO Setup

1. Install ESP32 board in Arduino IDE
2. Configure as follows:
   - Board: ESP32 Dev Module
   - Upload Speed: 921600 baud
   - Flash Frequency: 80 MHz

### 7.2 Update Firmware

Edit `room1.ino` and `room2.ino`:

```cpp
// Update WiFi credentials
#define SSID "your_wifi_ssid"
#define PASSWORD "your_wifi_password"

// Update Local Server IP
#define SERVER_IP "192.168.1.10"  // Your Local Server IP
#define SERVER_PORT 8080

// Update room identifier
#define ROOM_ID "room1"  // or "room2"
```

### 7.3 Upload Firmware

1. Connect ESP32 via USB
2. Select correct COM port
3. Click Upload
4. Monitor Serial for logs:
   ```
   WiFi connected: 192.168.1.100
   Connecting to WS server: 192.168.1.10:8080
   [connected]
   ```

## Step 8: System Testing

### 8.1 Check Backend Status

```bash
# Health checks
curl http://localhost:5000/health
curl http://localhost:3000/health

# Get connected ESPs
curl http://localhost:3000/api/control/status

# Get live stats
curl -H "Authorization: Bearer <your_jwt>" \
  http://localhost:5000/api/stats/live
```

### 8.2 Simulate Midnight Flush (Testing)

To test daily flush without waiting until midnight:

```javascript
// In Local_server, temporarily modify billingManager.js:
// Replace: cron.schedule('0 0 * * *', ...)
// With:    cron.schedule('*/1 * * * *', ...)  // Every minute

// Or manually call via Node console
const billingManager = require('./src/services/billingManager');
await billingManager.manualFlush();
```

### 8.3 Check Global Server Endpoints

```bash
# Register
POST http://localhost:5000/api/auth/register

# Login
POST http://localhost:5000/api/auth/login

# Get user
GET http://localhost:5000/api/auth/me
Header: Authorization: Bearer <token>

# Get live stats
GET http://localhost:5000/api/stats/live
Header: Authorization: Bearer <token>

# Get today's tariff
GET http://localhost:5000/api/tariff/today
Header: Authorization: Bearer <token>

# Get billing summary
GET http://localhost:5000/api/billing/summary
Header: Authorization: Bearer <token>
```

## Step 9: Production Deployment

### 9.1 environment Variables

Create `.env` files for production:

**Global Server (.env):**
```env
PORT=5000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/smart_metering?retryWrites=true
JWT_SECRET=<use_very_strong_random_secret>
JWT_EXPIRES_IN=7d
NODE_ENV=production
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

**Local Server (.env):**
```env
MONGODB_URI=mongodb://localhost:27017/smart_metering
WS_PORT=8080
HTTP_PORT=3000
GLOBAL_SERVER_URL=https://yourglobalserver.com
USER_JWT=<jwt_from_production_global_server>
NODE_ENV=production
```

### 9.2 Process Management

Use PM2 to keep services running:

```bash
npm install -g pm2

# Start Global Server
cd Global_server
pm2 start index.js --name "global-server"

# Start Local Server
cd ../Local_server
pm2 start src/index.js --name "local-server"

# View logs
pm2 logs

# Monitor
pm2 monit
```

### 9.3 Reverse Proxy (Recommended)

Use NGINX as reverse proxy for HTTPS:

```nginx
# Global Server
server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Authorization $http_authorization;
        proxy_pass_header Authorization;
    }
}
```

### 9.4 Backup Strategy

**MongoDB:**
```bash
# Backup
mongodump --uri="mongodb://localhost:27017/smart_metering" --out=./backup

# Restore
mongorestore ./backup/smart_metering --uri="mongodb://localhost:27017"
```

## Troubleshooting

### Local Server can't connect to Global Server

```bash
# Check Global Server is running
curl http://localhost:5000/health

# Verify JWT is valid (check expiration)
# Regenerate if needed:
# POST http://localhost:5000/api/auth/login
```

### ESP32 WebSocket connection fails

```cpp
// Check WiFi first
if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected!");
}

// Check Local Server IP
Serial.print("Connecting to: ");
Serial.println(SERVER_IP);

// Monitor websocket.onError callback
```

### IEX Scraper not working

```bash
# Check Puppeteer has access to Chromium
# For headless systems, install:
# Linux: sudo apt-get install chromium

# Check website structure hasn't changed
curl https://www.iexindia.com/market-data/real-time-market/market-snapshot
```

### MongoDB Connection Issues

```bash
# Check MongoDB is running
mongosh mongodb://localhost:27017

# Check credentials (for Atlas)
# Username/password are URL encoded in connection string

# Test connection string
node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => console.log('Connected')).catch(e => console.error(e))"
```

### High Memory Usage

```bash
# Check cache size
curl http://localhost:3000/api/control/status

# Monitor Node.js process
ps aux | grep node

# Use: top or htop
```

## Quick Start Commands

```bash
# Terminal 1: MongoDB
# (ensure mongod is running)

# Terminal 2: Global Server
cd Global_server
npm install
npm start

# Terminal 3: Register user (in PowerShell or curl)
$body = @{
    name = "Home Owner"
    email = "home@example.com"
    password = "secure123"
    localServerURL = "http://192.168.1.10:3000"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5000/api/auth/register" `
  -Method Post `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body

# Terminal 4: Local Server
cd Local_server
npm install
cp .env.example .env
# ... update .env with USER_JWT from step above
npm start

# Terminal 5: Simulator (optional)
cd Local_Simulator
node simulator.js

# Terminal 6: Frontend
# Open Frontend/index.html in browser
# Or serve via: python -m http.server 8000 (from Frontend/)
```

## Data Flow Examples

### Reading Saved and Pushed

```
1. ESP → WS → Local Server (receive in wsServer)
2. espDataCache.updateEspData() → MongoDB save (every 5s)
3. globalSender.sendReading() → Global Server /api/stats/push (every reading)
4. Global Server → LiveStats collection (upsert)
5. Frontend queries Global Server or Local Server for live data
```

### Daily Billing Calculated

```
1. At 00:00 → billingManager.flushAllRooms()
2. Calculate: avgVoltage, avgPowerFactor, peakPowerW from day's readings
3. GET IEXPrice records from Global Server DB for that day
4. Calculate: weightedAvgMCP, then costINR = energy × MCP / 1000
5. POST /api/billing/flush → Global Server stores DailyReading
6. DailyReading includes tariffSnapshot of all 15-min price blocks
```

### Relay Control

```
1. Frontend or Global Server → POST /api/control (HTTP)
2. Local Server looks up espClients["room1"]
3. Sends WebSocket message: { type: "control", load1: 1, load2: 0 }
4. ESP32 receives and switches relay
5. ESP sends updated parameters in next reading cycle
```

## Performance Targets

- **ESP → Local Server:** <100ms WebSocket latency
- **Local Server → Global Server:** 5s push interval, <500ms latency
- **Global Server Response:** <100ms for API GET requests
- **Daily Flush:** <5s total time for all rooms
- **IEX Scrape:** <10s completion time (every 15 min)

## Security Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Use HTTPS for all production endpoints
- [ ] Enable MongoDB authentication
- [ ] Restrict CORS_ORIGINS to known domains
- [ ] Implement rate limiting on auth endpoints
- [ ] Rotate JWT_SECRET periodically
- [ ] Use environment variables, never hardcode secrets
- [ ] Enable firewall on Local Server (only ports 8080 and 3000)
- [ ] Keep dependencies updated: `npm audit`
- [ ] Monitor error logs for suspicious activity

## Next Steps

1. Deploy Global Server to VPS/cloud
2. Set up HTTPS with Let's Encrypt
3. Configure monitoring and alerting
4. Add mobile app (React Native / Flutter)
5. Implement historical analysis dashboard
6. Add machine learning for load prediction
7. Integrate with smart grid APIs
8. Add solar/renewable energy tracking

Good luck with your IoT Smart Metering System! 🚀
