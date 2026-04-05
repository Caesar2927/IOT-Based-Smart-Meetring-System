# Local Server

This folder contains the organized local WebSocket server for ESP devices.

## Structure

- `package.json` - Node project metadata and dependencies.
- `.env.example` - Example environment variables.
- `src/index.js` - Entrypoint for starting the server.
- `src/db.js` - MongoDB connection helper.
- `src/wsServer.js` - WebSocket server and device handling.
- `src/models/Reading.js` - Mongoose schema for incoming data.
- `src/services/readingService.js` - Business logic for sanitizing and storing readings.
- `src/services/globalSender.js` - Optional forwarding to a global server.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI` and optionally `GLOBAL_SERVER_URL`.
3. Run:

```bash
cd Local_server
npm install
npm start
```

## Notes

- Incoming ESP data is stored in MongoDB.
- The server still broadcasts updates over WebSocket.
- If `GLOBAL_SERVER_URL` is set, data is also forwarded to that endpoint.
