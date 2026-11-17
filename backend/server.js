require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./src/database/db');
const { seed } = require('./src/database/seed');
const { initSocket } = require('./src/services/socketService');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const parkingRoutes = require('./src/routes/parkingRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const staffRoutes = require('./src/routes/staffRoutes');

const app = express();
const server = http.createServer(app);

// Port configuration
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
initSocket(server);

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Smart Parking Management System API',
    version: '1.0.0',
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/staff', staffRoutes);

// 404 Catch-All
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.url} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred',
    error: process.env.NODE_ENV === 'production' ? null : err.message,
  });
});

// Server Startup
async function startServer() {
  try {
    console.log('[System] Initializing database and services...');
    await initDatabase();
    await seed();

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  PARKSMART API SERVER RUNNING ON PORT ${PORT}`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`  Socket.IO: Ready for real-time customer & staff events`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[Fatal Error during startup]:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
