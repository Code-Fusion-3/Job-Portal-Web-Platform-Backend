require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { redisClient } = require('./utils/redis');
const { closePrismaConnections, checkDatabaseHealth } = require('./utils/database');
const WebSocketServer = require('./websocket');

const app = express();

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:4174',
      'https://braziconnect.netlify.app',
      'https://braziconnect.rw',
      'https://braziconnect.rw/'
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Additional CORS middleware as backup
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:5174', 
    'http://localhost:3000', 
    'http://localhost:5173', 
    'http://localhost:4173', 
    'http://localhost:4174',
    'https://braziconnect.netlify.app',
    'https://braziconnect.rw',
    'https://braziconnect.rw/'
  ];
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads', 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Routes
app.use('/auth', require('./routes/authRoutes'));
app.use('/employer', require('./routes/employerRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

app.get('/', (req, res) => {
  res.send('Job Portal Backend is running! CORS Updated v2.0');
});

// Test endpoint to verify CORS configuration
app.get('/cors-test', (req, res) => {
  res.json({
    message: 'CORS test endpoint',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    corsVersion: '2.0'
  });
});

// Profile routes
app.use('/profile', require('./routes/profileRoutes'));
// Category routes
app.use('/categories', require('./routes/categoryRoutes'));
// Public routes
app.use('/public', require('./routes/publicRoutes'));
// Dashboard routes
app.use('/dashboard', require('./routes/dashboardRoutes'));
// Messaging routes
app.use('/messaging', require('./routes/messagingRoutes'));
// Search routes
app.use('/search', require('./routes/searchRoutes'));
// Settings routes
app.use('/settings', require('./routes/settingsRoutes'));
// Security routes
app.use('/security', require('./routes/securityRoutes'));
// Contact routes
app.use('/contact', require('./routes/contactRoutes'));
// Payment routes
app.use('/payments', require('./routes/paymentRoutes'));
// Payment method routes
app.use('/payment-methods', require('./routes/paymentMethodRoutes'));
// Payment confirmation routes
app.use('/payment-confirmations', require('./routes/paymentConfirmationRoutes'));
// Admin profile routes
app.use('/admin-profile', require('./routes/adminProfileRoutes'));
// Request history and reporting routes
app.use('/request-history', require('./routes/requestHistoryRoutes'));
// Dashboard analytics routes
app.use('/dashboard', require('./routes/dashboardAnalyticsRoutes'));
// Employer authentication routes
app.use('/employer/auth', require('./routes/employerAuthRoutes'));

// Notification routes
app.use('/notifications', require('./routes/notificationRoutes'));

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Make WebSocket server available globally
global.wsServer = wsServer;

server.listen(PORT, () => {
  // console.log(`Server running on port ${PORT}`);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const redisHealth = redisClient.isReady ? 'healthy' : 'unhealthy';

    // Test database operations if database is healthy
    let dbOperations = null;
    if (dbHealth.status === 'healthy') {
      const { testDatabaseOperations } = require('./utils/database');
      dbOperations = await testDatabaseOperations();
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbHealth,
      databaseOperations: dbOperations,
      redis: redisHealth,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}); 