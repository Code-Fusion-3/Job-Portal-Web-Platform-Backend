const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin: Get dashboard statistics
router.get('/stats', authenticateToken, requireAdmin, dashboardController.getDashboardStats);

// Admin: Get detailed analytics
router.get('/analytics', authenticateToken, requireAdmin, dashboardController.getAnalytics);

module.exports = router; 