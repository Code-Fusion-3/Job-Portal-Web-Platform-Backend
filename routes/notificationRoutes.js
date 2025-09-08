const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All notification routes require authentication
router.use(authenticateToken);

// Get workflow notifications (admin only)
router.get('/workflow', requireAdmin, notificationController.getWorkflowNotifications);

// Get user notifications
router.get('/user', notificationController.getUserNotifications);

// Get notification statistics
router.get('/stats', notificationController.getNotificationStats);

// Get notification count
router.get('/count', notificationController.getNotificationCount);

// Mark notification as read
router.post('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.post('/mark-all-read', notificationController.markAllAsRead);

// Create workflow notification (admin only)
router.post('/workflow', requireAdmin, notificationController.createWorkflowNotification);

// Get notification preferences
router.get('/preferences', notificationController.getNotificationPreferences);

// Update notification preferences
router.post('/preferences', notificationController.updateNotificationPreference);

module.exports = router;