const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public: Submit contact message
router.post('/submit', contactController.submitContact);

// Admin: Get all contact messages
router.get('/admin/all', authenticateToken, requireAdmin, contactController.getAllContacts);

// Admin: Get contact statistics (must come before :id route)
router.get('/admin/statistics', authenticateToken, requireAdmin, contactController.getContactStatistics);

// Admin: Get specific contact message
router.get('/admin/:id', authenticateToken, requireAdmin, contactController.getContact);

// Admin: Respond to contact message
router.post('/admin/:id/respond', authenticateToken, requireAdmin, contactController.respondToContact);

// Admin: Update contact status
router.put('/admin/:id/status', authenticateToken, requireAdmin, contactController.updateContactStatus);

// Admin: Delete contact message
router.delete('/admin/:id', authenticateToken, requireAdmin, contactController.deleteContact);

module.exports = router; 