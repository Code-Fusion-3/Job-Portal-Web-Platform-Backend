const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Admin: Export system data
router.get('/export', authenticateToken, requireAdmin, adminController.exportSystemData);

// Admin: Get system health
router.get('/health', authenticateToken, requireAdmin, adminController.getSystemHealth);

// Admin: Get system logs
router.get('/logs', authenticateToken, requireAdmin, adminController.getSystemLogs);

// Admin: Get platform statistics
router.get('/platform-stats', authenticateToken, requireAdmin, adminController.getPlatformStats);

module.exports = router; 