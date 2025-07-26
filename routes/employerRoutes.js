const express = require('express');
const router = express.Router();
const employerController = require('../controllers/employerController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Submit employer request (no authentication required)
router.post('/request', employerController.submitEmployerRequest);

// Admin: Get all employer requests
router.get('/requests', authenticateToken, requireAdmin, employerController.getAllEmployerRequests);

// Admin: Get specific employer request with messages
router.get('/requests/:id', authenticateToken, requireAdmin, employerController.getEmployerRequest);

// Admin: Reply to employer request
router.post('/requests/:id/reply', authenticateToken, requireAdmin, employerController.replyToEmployerRequest);

// Admin: Select job seeker for employer request
router.post('/requests/:id/select', authenticateToken, requireAdmin, employerController.selectJobSeekerForRequest);

module.exports = router; 