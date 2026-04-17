require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const { scrapeIEXPrices } = require('./services/iexScraper');

// Import routes
const authRoutes = require('./routes/auth');
const statsRoutes = require('./routes/stats');
const billingRoutes = require('./routes/billing');
const tariffRoutes = require('./routes/tariff');
const dsmRoutes = require('./routes/dsm');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/tariff', tariffRoutes);
app.use('/api/dsm', dsmRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

/**
 * Initialize server
 */
const initializeServer = async () => {
  try {
    // Connect to MongoDB
    console.log('[MongoDB] Connecting to', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[MongoDB] Connected successfully');

    // Start Express server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`[Express] Server running on port ${PORT}`);
    });

    // Run IEX scraper immediately on startup
    console.log('[IEX Scraper] Running initial scrape...');
    await scrapeIEXPrices();

    // Schedule IEX scraper to run every 15 minutes
    // Cron expression: */15 * * * * (every 15 minutes)
    cron.schedule('*/15 * * * *', async () => {
      console.log('[Cron] IEX Scraper triggered at', new Date());
      try {
        await scrapeIEXPrices();
      } catch (err) {
        console.error('[Cron] IEX Scraper error:', err);
      }
    });

    console.log('[Cron] Scheduled IEX Scraper to run every 15 minutes');

  } catch (err) {
    console.error('[Error] Failed to initialize server:', err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Start the server
initializeServer();

module.exports = app;
