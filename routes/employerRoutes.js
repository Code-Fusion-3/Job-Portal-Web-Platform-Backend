const express = require('express');
const router = express.Router();
const employerController = require('../controllers/employerController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Submit employer request (no authentication required)
router.post('/request', employerController.submitEmployerRequest);

// Employer: Get dashboard data (requires authentication)
router.get('/dashboard', authenticateToken, employerController.getEmployerDashboard);

// Admin: Get all employer requests
router.get('/requests', authenticateToken, requireAdmin, employerController.getAllEmployerRequests);

// Admin: Get request statistics
router.get('/requests/stats', authenticateToken, requireAdmin, employerController.getRequestStats);

// Admin: Get specific employer request with messages
router.get('/requests/:id', authenticateToken, requireAdmin, employerController.getEmployerRequest);

// Admin: Reply to employer request
router.post('/requests/:id/reply', authenticateToken, requireAdmin, employerController.replyToEmployerRequest);

// Admin: Select job seeker for employer request
router.post('/requests/:id/select', authenticateToken, requireAdmin, employerController.selectJobSeekerForRequest);

// Admin: Approve employer request
router.post('/requests/:id/approve', authenticateToken, requireAdmin, employerController.approveEmployerRequest);

// Admin: Update request status
router.put('/requests/:id/status', authenticateToken, requireAdmin, employerController.updateRequestStatus);

// ===== NEW WORKFLOW ROUTES =====

// Employer: Request full details
router.post('/requests/:requestId/request-full-details', authenticateToken, employerController.requestFullDetails);

// Employer: Mark hiring decision
router.post('/requests/:requestId/mark-hired', authenticateToken, employerController.markHiringDecision);
router.post('/requests/:requestId/mark-not-hired', authenticateToken, employerController.markHiringDecision);

// Employer: Get candidate access
router.get('/requests/:requestId/photo-access', authenticateToken, employerController.getPhotoAccess);
router.get('/requests/:requestId/full-details', authenticateToken, employerController.getFullDetails);

module.exports = router; 