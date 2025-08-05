const { PrismaClient } = require("@prisma/client");
const { sendContactNotification, sendContactConfirmation, sendContactResponse } = require('../utils/mailer');
const { getAdminEmail } = require('../utils/adminUtils');

const prisma = new PrismaClient();

// Public: Submit contact message
exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message, category = 'general' } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: [
          { field: 'name', message: 'Name is required' },
          { field: 'email', message: 'Email is required' },
          { field: 'subject', message: 'Subject is required' },
          { field: 'message', message: 'Message is required' }
        ]
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
        details: [{ field: 'email', message: 'Please provide a valid email address' }]
      });
    }

    // Validate category
    const validCategories = ['general', 'support', 'feedback', 'business', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        details: [{ field: 'category', message: 'Category must be one of: general, support, feedback, business, other' }]
      });
    }

    // Get admin email from database
    const adminEmail = await getAdminEmail();

    // Create contact message
    const contact = await prisma.contact.create({
      data: {
        name,
        email,
        subject,
        message,
        category,
        status: 'unread',
        priority: 'normal'
      }
    });

    // Send notification email to admin
    const adminEmailResult = await sendContactNotification(contact, adminEmail);
    
    // Send confirmation email to sender
    const senderEmailResult = await sendContactConfirmation(contact);

    res.status(201).json({
      message: 'Contact message submitted successfully. We will respond to you soon.',
      contact: {
        id: contact.id,
        subject: contact.subject,
        category: contact.category,
        submittedAt: contact.createdAt
      }
    });
  } catch (err) {
    console.error('Contact submission error:', err);
    res.status(500).json({ error: 'Failed to submit contact message.' });
  }
};

// Admin: Get all contact messages
exports.getAllContacts = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { 
      page = 1, 
      limit = 10, 
      status, 
      category, 
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (page - 1) * limit;

    // Build where conditions
    const whereConditions = {};

    if (status) {
      whereConditions.status = status;
    }

    if (category) {
      whereConditions.category = category;
    }

    if (priority) {
      whereConditions.priority = priority;
    }

    if (search) {
      whereConditions.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Build sort conditions
    const sortConditions = {};
    sortConditions[sortBy] = sortOrder;

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: whereConditions,
        include: {
          admin: {
            select: {
              id: true,
              email: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: sortConditions
      }),
      prisma.contact.count({ where: whereConditions })
    ]);

    // Get statistics
    const [unreadCount, respondedCount, totalCount] = await Promise.all([
      prisma.contact.count({ where: { status: 'unread' } }),
      prisma.contact.count({ where: { status: 'responded' } }),
      prisma.contact.count()
    ]);

    res.json({
      contacts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      },
      statistics: {
        unread: unreadCount,
        responded: respondedCount,
        total: totalCount
      },
      filters: {
        status,
        category,
        priority,
        search
      }
    });
  } catch (err) {
    console.error('Get contacts error:', err);
    res.status(500).json({ error: 'Failed to get contact messages.' });
  }
};

// Admin: Get specific contact message
exports.getContact = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) },
      include: {
        admin: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    // Mark as read if unread
    if (contact.status === 'unread') {
      await prisma.contact.update({
        where: { id: parseInt(id) },
        data: { status: 'read' }
      });
      contact.status = 'read';
    }

    res.json({ contact });
  } catch (err) {
    console.error('Get contact error:', err);
    res.status(500).json({ error: 'Failed to get contact message.' });
  }
};

// Admin: Respond to contact message
exports.respondToContact = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { id } = req.params;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        error: 'Subject and message are required',
        details: [
          { field: 'subject', message: 'Response subject is required' },
          { field: 'message', message: 'Response message is required' }
        ]
      });
    }

    // Get contact message
    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    if (contact.status === 'responded') {
      return res.status(400).json({ error: 'Contact message has already been responded to.' });
    }

    // Update contact with admin response
    const updatedContact = await prisma.contact.update({
      where: { id: parseInt(id) },
      data: {
        adminResponse: message,
        adminResponseSubject: subject,
        respondedBy: req.user.userId,
        respondedAt: new Date(),
        status: 'responded'
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    // Send response email to contactor
    await sendContactResponse(updatedContact);

    res.json({
      message: 'Response sent successfully',
      contact: updatedContact
    });
  } catch (err) {
    console.error('Respond to contact error:', err);
    res.status(500).json({ error: 'Failed to send response.' });
  }
};

// Admin: Update contact status
exports.updateContactStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { id } = req.params;
    const { status, priority } = req.body;

    const validStatuses = ['unread', 'read', 'responded', 'archived'];
    const validPriorities = ['low', 'normal', 'high', 'urgent'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        details: [{ field: 'status', message: 'Status must be one of: unread, read, responded, archived' }]
      });
    }

    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({
        error: 'Invalid priority',
        details: [{ field: 'priority', message: 'Priority must be one of: low, normal, high, urgent' }]
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;

    const contact = await prisma.contact.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        admin: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: 'Contact status updated successfully',
      contact
    });
  } catch (err) {
    console.error('Update contact status error:', err);
    res.status(500).json({ error: 'Failed to update contact status.' });
  }
};

// Admin: Delete contact message
exports.deleteContact = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { id } = req.params;

    const contact = await prisma.contact.findUnique({
      where: { id: parseInt(id) }
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact message not found.' });
    }

    await prisma.contact.delete({
      where: { id: parseInt(id) }
    });

    res.json({ message: 'Contact message deleted successfully.' });
  } catch (err) {
    console.error('Delete contact error:', err);
    res.status(500).json({ error: 'Failed to delete contact message.' });
  }
};

// Admin: Get contact statistics
exports.getContactStatistics = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { period = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const [
      totalContacts,
      unreadContacts,
      respondedContacts,
      contactsByCategory,
      contactsByStatus,
      recentContacts
    ] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { status: 'unread' } }),
      prisma.contact.count({ where: { status: 'responded' } }),
      prisma.contact.groupBy({
        by: ['category'],
        _count: { category: true }
      }),
      prisma.contact.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.contact.findMany({
        where: {
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      statistics: {
        total: totalContacts,
        unread: unreadContacts,
        responded: respondedContacts,
        responseRate: totalContacts > 0 ? (respondedContacts / totalContacts * 100).toFixed(1) : 0
      },
      byCategory: contactsByCategory.map(item => ({
        category: item.category,
        count: item._count.category
      })),
      byStatus: contactsByStatus.map(item => ({
        status: item.status,
        count: item._count.status
      })),
      recent: recentContacts
    });
  } catch (err) {
    console.error('Get contact statistics error:', err);
    res.status(500).json({ error: 'Failed to get contact statistics.' });
  }
}; 