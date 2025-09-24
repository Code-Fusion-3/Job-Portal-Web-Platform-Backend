const { getPrismaClient } = require('../utils/database');
const { sendStatusUpdateNotification } = require('../utils/notificationMailer');

/**
 * Notification Service for managing all notifications in the system
 */
class NotificationService {
  /**
   * Send notification to a user
   * @param {number} userId - User ID to send notification to
   * @param {Object} notificationData - Notification data
   * @param {string} notificationData.type - Notification type
   * @param {string} notificationData.title - Notification title
   * @param {string} notificationData.message - Notification message
   * @param {number} [notificationData.employerRequestId] - Optional employer request ID
   */
  static async sendNotification(userId, notificationData) {
    try {
      const prisma = await getPrismaClient();
      
      const notification = await prisma.notification.create({
        data: {
          userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          employerRequestId: notificationData.employerRequestId || null
        }
      });

      console.log(`✅ Notification sent to user ${userId}: ${notificationData.title}`);
      return notification;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to admin users
   * @param {Object} notificationData - Notification data
   */
  static async sendAdminNotification(notificationData) {
    try {
      const prisma = await getPrismaClient();
      
      // Find all admin users
      const adminUsers = await prisma.user.findMany({
        where: { role: 'admin' }
      });

      // Send notification to each admin
      const notifications = await Promise.all(
        adminUsers.map(admin => 
          this.sendNotification(admin.id, notificationData)
        )
      );

      console.log(`✅ Admin notification sent to ${adminUsers.length} admins: ${notificationData.title}`);
      return notifications;
    } catch (error) {
      console.error('❌ Error sending admin notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to candidate (job seeker)
   * @param {number} candidateId - Candidate user ID
   * @param {Object} notificationData - Notification data
   */
  static async sendCandidateNotification(candidateId, notificationData) {
    try {
      return await this.sendNotification(candidateId, notificationData);
    } catch (error) {
      console.error('❌ Error sending candidate notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to employer
   * @param {number} employerUserId - Employer user ID
   * @param {Object} notificationData - Notification data
   */
  static async sendEmployerNotification(employerUserId, notificationData) {
    try {
      return await this.sendNotification(employerUserId, notificationData);
    } catch (error) {
      console.error('❌ Error sending employer notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {number} userId - User ID
   * @param {Object} options - Query options
   * @param {boolean} [options.unreadOnly] - Only get unread notifications
   * @param {number} [options.limit] - Limit number of results
   */
  static async getUserNotifications(userId, options = {}) {
    try {
      const prisma = await getPrismaClient();
      
      const where = { userId };
      if (options.unreadOnly) {
        where.isRead = false;
      }

      const notifications = await prisma.notification.findMany({
        where,
        include: {
          employerRequest: {
            include: {
              requestedCandidate: {
                select: { id: true, name: true }
              },
              employerAccount: {
                include: {
                  user: {
                    select: { id: true, name: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50
      });

      return notifications;
    } catch (error) {
      console.error('❌ Error getting user notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @param {number} userId - User ID (for security)
   */
  static async markAsRead(notificationId, userId) {
    try {
      const prisma = await getPrismaClient();
      
      const notification = await prisma.notification.update({
        where: {
          id: notificationId,
          userId // Ensure user can only mark their own notifications as read
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      return notification;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {number} userId - User ID
   */
  static async markAllAsRead(userId) {
    try {
      const prisma = await getPrismaClient();
      
      const result = await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      console.log(`✅ Marked ${result.count} notifications as read for user ${userId}`);
      return result;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics for a user
   * @param {number} userId - User ID
   */
  static async getNotificationStats(userId) {
    try {
      const prisma = await getPrismaClient();
      
      const [total, unread] = await Promise.all([
        prisma.notification.count({
          where: { userId }
        }),
        prisma.notification.count({
          where: { 
            userId,
            isRead: false 
          }
        })
      ]);

      return {
        total,
        unread,
        read: total - unread
      };
    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   * @param {Object} emailData - Email data
   * @param {string} emailData.to - Recipient email
   * @param {string} emailData.subject - Email subject
   * @param {string} emailData.html - Email HTML content
   */
  static async sendEmail(emailData) {
    try {
      // Use the existing mailer function for status updates
      // For now, we'll use a generic email sending approach
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD
        }
      });

      const mailOptions = {
        from: `"Braziconnect Portal" <${process.env.GMAIL_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;
