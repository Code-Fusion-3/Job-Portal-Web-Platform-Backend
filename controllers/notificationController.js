const { getPrismaClient } = require('../utils/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

/**
 * Get workflow notifications for admin
 */
const getWorkflowNotifications = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    // Get notifications for the current admin user
    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id,
        type: 'workflow'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50 // Limit to 50 most recent
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
        type: 'workflow'
      }
    });

    res.json({
      success: true,
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching workflow notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * Get user notifications (for NotificationCenter)
 */
const getUserNotifications = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    const notifications = await prisma.notification.findMany({
      where: {
        userId: req.user.id
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100
    });

    res.json({
      success: true,
      notifications
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

/**
 * Get notification statistics
 */
const getNotificationStats = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    const total = await prisma.notification.count({
      where: {
        userId: req.user.id
      }
    });

    const unread = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false
      }
    });

    const workflow = await prisma.notification.count({
      where: {
        userId: req.user.id,
        type: 'workflow'
      }
    });

    res.json({
      success: true,
      stats: {
        total,
        unread,
        workflow,
        read: total - unread
      }
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification stats',
      error: error.message
    });
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const prisma = await getPrismaClient();

    const notification = await prisma.notification.update({
      where: {
        id: parseInt(id),
        userId: req.user.id // Ensure user can only update their own notifications
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

/**
 * Mark all notifications as read
 */
const markAllAsRead = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false
      },
      data: {
        isRead: true
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

/**
 * Create workflow notification
 */
const createWorkflowNotification = async (req, res) => {
  try {
    const { type, message, requestId, status } = req.body;
    const prisma = await getPrismaClient();

    const notification = await prisma.notification.create({
      data: {
        userId: req.user.id,
        type: type || 'workflow',
        message,
        requestId: requestId ? parseInt(requestId) : null,
        status,
        isRead: false
      }
    });

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    console.error('Error creating workflow notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message
    });
  }
};

/**
 * Get notification count
 */
const getNotificationCount = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false
      }
    });

    res.json({
      success: true,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notification count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification count',
      error: error.message
    });
  }
};

/**
 * Get notification preferences
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    // Get user's notification preferences
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        userId: req.user.id
      }
    });

    // Extract opted out types
    const optedOutTypes = preferences
      .filter(pref => pref.optedOut)
      .map(pref => pref.type);

    res.json({
      success: true,
      optedOutTypes,
      preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification preferences',
      error: error.message
    });
  }
};

/**
 * Update notification preference
 */
const updateNotificationPreference = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { type, optedOut } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'Notification type is required'
      });
    }

    // Upsert notification preference
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_type: {
          userId: req.user.id,
          type: type
        }
      },
      update: {
        optedOut: Boolean(optedOut)
      },
      create: {
        userId: req.user.id,
        type: type,
        optedOut: Boolean(optedOut)
      }
    });

    res.json({
      success: true,
      message: `Notification preference updated for ${type}`,
      preference
    });
  } catch (error) {
    console.error('Error updating notification preference:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preference',
      error: error.message
    });
  }
};

module.exports = {
  getWorkflowNotifications,
  getUserNotifications,
  getNotificationStats,
  markAsRead,
  markAllAsRead,
  createWorkflowNotification,
  getNotificationCount,
  getNotificationPreferences,
  updateNotificationPreference
};