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
const WebSocketServer = require('./websocket');

const app = express();

// Middleware
app.use(cors());
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
  res.send('Job Portal Backend is running!');
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

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Make WebSocket server available globally
global.wsServer = wsServer;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 