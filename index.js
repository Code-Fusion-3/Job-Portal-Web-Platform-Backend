const express = require('express');
const cors = require('cors');
const path = require('path');
const { redisClient } = require('./utils/redis');

const app = express();

app.use(express.json());
app.use(cors());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.send('Job Portal Backend is running!');
});

// Auth routes
app.use('/', require('./routes/authRoutes'));
// Profile routes
app.use('/profile', require('./routes/profileRoutes'));
// Employer routes
app.use('/employer', require('./routes/employerRoutes'));
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 