const express = require('express');
const router = express.Router();
const messagingController = require('../controllers/messagingController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { uploadMessageFile } = require('../middleware/upload');

// Admin: Send message to employer (with file upload support)
router.post('/admin/:id/send', 
  authenticateToken, 
  requireAdmin, 
  uploadMessageFile.single('attachment'),
  messagingController.sendAdminMessage
);

// Employer: Reply to admin message (public endpoint with file upload)
router.post('/employer/:id/reply', 
  uploadMessageFile.single('attachment'),
  messagingController.sendEmployerReply
);

// Get conversation (admin or employer with email)
router.get('/conversation/:id', messagingController.getConversation);

// Mark messages as read
router.post('/conversation/:id/read', 
  authenticateToken, 
  messagingController.markAsRead
);

// Get unread message count
router.get('/conversation/:id/unread', 
  authenticateToken, 
  messagingController.getUnreadCount
);

// Admin: Get all conversations with unread counts
router.get('/admin/conversations', 
  authenticateToken, 
  requireAdmin, 
  messagingController.getAllConversations
);

module.exports = router; 