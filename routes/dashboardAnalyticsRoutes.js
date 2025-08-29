const express = require('express');
const router = express.Router();
const { 
  getDashboardAnalytics,
  getActivityFeed
} = require('../controllers/dashboardAnalyticsController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin routes (require authentication and admin role)
router.get('/analytics', authenticateToken, requireAdmin, getDashboardAnalytics);
router.get('/activity-feed', authenticateToken, requireAdmin, getActivityFeed);

module.exports = router;
