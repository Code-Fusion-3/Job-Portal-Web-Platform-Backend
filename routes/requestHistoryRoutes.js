const express = require('express');
const router = express.Router();
const { 
  getEmployerRequestHistory,
  getRequestReports,
  getEmployerAnalytics
} = require('../controllers/requestHistoryController');
const { authenticateToken, requireAdmin, requireEmployer } = require('../middleware/auth');

// Employer routes (require authentication and employer role)
router.get('/employer/history', authenticateToken, requireEmployer, getEmployerRequestHistory);

// Admin routes (require authentication and admin role)
router.get('/admin/reports', authenticateToken, requireAdmin, getRequestReports);
router.get('/admin/employer/:employerId/analytics', authenticateToken, requireAdmin, getEmployerAnalytics);

module.exports = router;
