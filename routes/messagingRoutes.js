const express = require('express');
const router = express.Router();
const messagingController = require('../controllers/messagingController');
const { authenticateToken } = require('../middleware/auth');

// All messaging routes require authentication
router.use(authenticateToken);

// Get messages for a specific request
router.get('/request/:requestId', messagingController.getMessagesByRequest);

// Send a message
router.post('/request/:requestId', messagingController.sendMessage);

// Mark messages as read
router.patch('/request/:requestId/read', messagingController.markMessagesAsRead);

// Get unread message count for current user
router.get('/unread-count', messagingController.getUnreadCount);

// Delete a message (admin or message owner only)
router.delete('/message/:messageId', messagingController.deleteMessage);

module.exports = router; 