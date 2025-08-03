const { PrismaClient } = require("@prisma/client");
const { sendAdminReplyNotification, sendEmployerReplyNotification } = require('../utils/mailer');
const { messageCache, realTimeMessaging, rateLimiter } = require('../utils/redis');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;

const prisma = new PrismaClient();

// Admin: Send message to employer
exports.sendAdminMessage = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { content, messageType = 'text' } = req.body;
    const adminId = req.user.id;

    if (!content) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Rate limiting for admin messages
    const rateLimitKey = `admin_message:${adminId}`;
    const isAllowed = await rateLimiter.checkRateLimit(rateLimitKey, 10, 60); // 10 messages per minute
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before sending another message.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Check if request is approved - block further communication
    if (request.status === 'approved') {
      return res.status(400).json({ 
        error: 'Cannot send messages for approved requests. Communication is closed after approval.' 
      });
    }

    // Check if request is cancelled or completed
    if (request.status === 'cancelled' || request.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot send messages for cancelled or completed requests.' 
      });
    }

    // Handle file attachment
    let attachmentUrl = null;
    let attachmentName = null;
    
    if (req.file && messageType === 'file') {
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `message_${uuidv4()}${fileExtension}`;
      const filePath = `uploads/messages/${fileName}`;
      
      // Move file to messages directory
      await fs.rename(req.file.path, filePath);
      
      attachmentUrl = filePath;
      attachmentName = req.file.originalname;
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        employerRequestId: requestId,
        fromAdmin: true,
        employerEmail: request.email,
        content,
        messageType,
        attachmentUrl,
        attachmentName
      }
    });

    // Cache the message
    await messageCache.cacheMessage(message.id, message);

    // Send email notification to employer
    try {
      await sendAdminReplyNotification(request.email, request.name, content, attachmentName);
    } catch (emailError) {
      console.error('Failed to send admin reply notification:', emailError);
    }

    // Increment unread count for employer
    await realTimeMessaging.incrementUnreadCount('employer', requestId);

    // Publish real-time notification
    await realTimeMessaging.publishMessage(`employer_${requestId}`, {
      type: 'new_message',
      message: {
        id: message.id,
        content,
        messageType,
        attachmentUrl,
        attachmentName,
        fromAdmin: true,
        createdAt: message.createdAt
      }
    });

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: message
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send message.' });
  }
};

// Employer: Reply to admin message (public endpoint)
exports.sendEmployerReply = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { email, content, messageType = 'text' } = req.body;

    if (!email || !content) {
      return res.status(400).json({ error: 'Email and message content are required.' });
    }

    // Rate limiting for employer messages
    const rateLimitKey = `employer_message:${email}`;
    const isAllowed = await rateLimiter.checkRateLimit(rateLimitKey, 5, 60); // 5 messages per minute
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before sending another message.' });
    }

    // Check if request exists and email matches
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request || request.email !== email) {
      return res.status(404).json({ error: 'Employer request not found or email does not match.' });
    }

    // Check if request is approved - block further communication
    if (request.status === 'approved') {
      return res.status(400).json({ 
        error: 'Cannot send messages for approved requests. Communication is closed after approval.' 
      });
    }

    // Check if request is cancelled or completed
    if (request.status === 'cancelled' || request.status === 'completed') {
      return res.status(400).json({ 
        error: 'Cannot send messages for cancelled or completed requests.' 
      });
    }

    // Handle file attachment
    let attachmentUrl = null;
    let attachmentName = null;
    
    if (req.file && messageType === 'file') {
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `message_${uuidv4()}${fileExtension}`;
      const filePath = `uploads/messages/${fileName}`;
      
      // Move file to messages directory
      await fs.rename(req.file.path, filePath);
      
      attachmentUrl = filePath;
      attachmentName = req.file.originalname;
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        employerRequestId: requestId,
        fromAdmin: false,
        employerEmail: email,
        content,
        messageType,
        attachmentUrl,
        attachmentName
      }
    });

    // Cache the message
    await messageCache.cacheMessage(message.id, message);

    // Send email notification to admin
    try {
      await sendEmployerReplyNotification(email, request.name, content, attachmentName);
    } catch (emailError) {
      console.error('Failed to send employer reply notification:', emailError);
    }

    // Increment unread count for admin
    await realTimeMessaging.incrementUnreadCount('admin', requestId);

    // Publish real-time notification
    await realTimeMessaging.publishMessage(`admin_${requestId}`, {
      type: 'new_message',
      message: {
        id: message.id,
        content,
        messageType,
        attachmentUrl,
        attachmentName,
        fromAdmin: false,
        createdAt: message.createdAt
      }
    });

    res.status(201).json({
      message: 'Reply sent successfully',
      messageData: message
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to send reply.' });
  }
};

// Get conversation with caching
exports.getConversation = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { email } = req.query; // For employer access

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Check access permissions
    if (req.user && req.user.role === 'admin') {
      // Admin can access any conversation
    } else if (email && request.email === email) {
      // Employer can access their own conversation
    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Try to get cached conversation
    let messages = await messageCache.getCachedConversation(requestId);

    if (!messages) {
      // Get from database
      messages = await prisma.message.findMany({
        where: { employerRequestId: requestId },
        orderBy: { createdAt: 'asc' }
      });

      // Cache the conversation
      await messageCache.cacheConversation(requestId, messages);
    }

    // Mark messages as read for the current user
    if (req.user) {
      const userId = req.user.role === 'admin' ? 'admin' : 'employer';
      await realTimeMessaging.markAsRead(userId, requestId);
    }

    res.json({
      requestId,
      employerEmail: request.email,
      employerName: request.name,
      messages,
      unreadCount: req.user ? await realTimeMessaging.getUnreadCount(req.user.role === 'admin' ? 'admin' : 'employer', requestId) : 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch conversation.' });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const messageIds = req.body.messageIds || [];

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Update message read status
    if (messageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: messageIds },
          employerRequestId: requestId
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });
    }

    // Mark as read in Redis
    const userId = req.user.role === 'admin' ? 'admin' : 'employer';
    await realTimeMessaging.markAsRead(userId, requestId);

    res.json({ message: 'Messages marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark messages as read.' });
  }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const userId = req.user.role === 'admin' ? 'admin' : 'employer';
    const unreadCount = await realTimeMessaging.getUnreadCount(userId, requestId);

    res.json({ unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get unread count.' });
  }
};

// Admin: Get all conversations with unread counts
exports.getAllConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      prisma.employerRequest.findMany({
        include: {
          selectedUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  skills: true
                }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1 // Get latest message
          },
          _count: {
            select: {
              messages: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.employerRequest.count()
    ]);

    // Get unread counts for each request
    const requestsWithUnread = await Promise.all(
      requests.map(async (request) => {
        const unreadCount = await realTimeMessaging.getUnreadCount('admin', request.id);
        return {
          ...request,
          unreadCount
        };
      })
    );

    res.json({
      requests: requestsWithUnread,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch conversations.' });
  }
}; 