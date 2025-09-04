const { getPrismaClient } = require('../utils/database');

// Get all messages for a specific employer request
const getMessagesByRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const prisma = await getPrismaClient();
    
    // Verify the request exists and user has access
    const request = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        employerAccount: {
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user is admin or the employer who owns this request
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.role === 'employer' && 
                   request.employerAccount?.user?.id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const messages = await prisma.message.findMany({
      where: { employerRequestId: parseInt(requestId) },
      orderBy: { createdAt: 'asc' },
      skip,
      take: parseInt(limit),
      include: {
        employerRequest: {
          select: {
            id: true,
            status: true,
            priority: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalMessages = await prisma.message.count({
      where: { employerRequestId: parseInt(requestId) }
    });

    // Mark messages as read for the current user
    if (req.user?.role === 'employer') {
      await prisma.message.updateMany({
        where: {
          employerRequestId: parseInt(requestId),
          fromAdmin: true,
          isRead: false
        },
        data: { isRead: true, readAt: new Date() }
      });
    }

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
};

// Send a message (employer to admin or admin to employer)
const sendMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { content, messageType = 'text', attachmentName, attachmentUrl } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const prisma = await getPrismaClient();
    
    // Verify the request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        employerAccount: {
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check permissions
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.role === 'employer' && 
                   request.employerAccount?.user?.id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        employerRequestId: parseInt(requestId),
        fromAdmin: isAdmin,
        content: content.trim(),
        messageType,
        attachmentName,
        attachmentUrl,
        isRead: false
      },
      include: {
        employerRequest: {
          select: {
            id: true,
            status: true,
            priority: true
          }
        }
      }
    });

    // Update request status if this is the first message
    if (request.status === 'pending') {
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId) },
        data: { status: 'reviewing' }
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'message_sent',
        entityType: 'message',
        entityId: message.id,
        userId: req.user.id,
        userRole: req.user.role,
        details: {
          requestId: parseInt(requestId),
          fromAdmin: isAdmin,
          messageType
        }
      }
    });

    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
};

// Mark messages as read
const markMessagesAsRead = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { messageIds } = req.body;
    
    const prisma = await getPrismaClient();
    
    // Verify the request exists and user has access
    const request = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId) },
      include: {
        employerAccount: {
          include: {
            user: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check permissions
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.role === 'employer' && 
                   request.employerAccount?.user?.id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mark specific messages as read
    if (messageIds && messageIds.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: messageIds.map(id => parseInt(id)) },
          employerRequestId: parseInt(requestId)
        },
        data: { isRead: true, readAt: new Date() }
      });
    } else {
      // Mark all unread messages as read
      await prisma.message.updateMany({
        where: {
          employerRequestId: parseInt(requestId),
          fromAdmin: !isAdmin, // Mark messages from the other party as read
          isRead: false
        },
        data: { isRead: true, readAt: new Date() }
      });
    }

    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

// Get unread message count for a user
const getUnreadCount = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    
    let unreadCount = 0;
    
    if (req.user?.role === 'admin') {
      // Count unread messages from employers to admin
      unreadCount = await prisma.message.count({
        where: {
          fromAdmin: false,
          isRead: false
        }
      });
    } else if (req.user?.role === 'employer') {
      // Count unread messages from admin to this employer
      unreadCount = await prisma.message.count({
        where: {
          fromAdmin: true,
          isRead: false,
          employerRequest: {
            employerAccount: {
              user: {
                id: req.user.id
              }
            }
          }
        }
      });
    }

    res.json({ unreadCount });

  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
};

// Delete a message (only for admin or message owner)
const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    
    const prisma = await getPrismaClient();
    
    // Get the message with request details
    const message = await prisma.message.findUnique({
      where: { id: parseInt(messageId) },
      include: {
        employerRequest: {
          include: {
            employerAccount: {
        include: {
                user: {
                  select: { id: true }
                }
              }
            }
          }
        }
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check permissions - only admin or message owner can delete
    const isAdmin = req.user?.role === 'admin';
    const isOwner = req.user?.role === 'employer' && 
                   message.employerRequest.employerAccount?.user?.id === req.user.id;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: parseInt(messageId) }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'message_deleted',
        entityType: 'message',
        entityId: parseInt(messageId),
        userId: req.user.id,
        userRole: req.user.role,
        details: {
          requestId: message.employerRequestId,
          fromAdmin: message.fromAdmin
        }
      }
    });

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
};

module.exports = {
  getMessagesByRequest,
  sendMessage,
  markMessagesAsRead,
  getUnreadCount,
  deleteMessage
}; 