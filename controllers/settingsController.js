const { PrismaClient } = require("@prisma/client");
const { sessionManager } = require('../utils/redis');

const prisma = new PrismaClient();

// Admin: Get system settings
exports.getSystemSettings = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    // Get system statistics
    const [totalUsers, totalRequests, totalCategories, recentActivity] = await Promise.all([
      prisma.user.count({ where: { role: 'jobseeker' } }),
      prisma.employerRequest.count(),
      prisma.jobCategory.count(),
      prisma.user.count({
        where: {
          role: 'jobseeker',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);

    // Default system settings
    const defaultSettings = {
      system: {
        name: 'Job Portal',
        version: '1.0.0',
        maintenance: false,
        registrationEnabled: true,
        emailNotifications: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxUploadsPerUser: 5
      },
      email: {
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: process.env.SMTP_PORT || 587,
        fromEmail: process.env.GMAIL_USER,
        replyTo: process.env.ADMIN_EMAIL || process.env.GMAIL_USER
      },
      security: {
        sessionTimeout: 24 * 60 * 60, // 24 hours
        maxLoginAttempts: 5,
        passwordMinLength: 6,
        requireEmailVerification: false
      },
      features: {
        fileUploads: true,
        realTimeMessaging: true,
        searchSuggestions: true,
        analytics: true
      }
    };

    // Get cached settings from Redis
    const cachedSettings = await sessionManager.getSession('system_settings');
    const settings = cachedSettings || defaultSettings;

    res.json({
      settings,
      statistics: {
        totalUsers,
        totalRequests,
        totalCategories,
        recentActivity
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get system settings.' });
  }
};

// Admin: Update system settings
exports.updateSystemSettings = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { system, email, security, features } = req.body;

    // Validate settings
    if (system) {
      if (system.maxFileSize && system.maxFileSize > 50 * 1024 * 1024) {
        return res.status(400).json({ error: 'Max file size cannot exceed 50MB.' });
      }
      if (system.maxUploadsPerUser && system.maxUploadsPerUser > 20) {
        return res.status(400).json({ error: 'Max uploads per user cannot exceed 20.' });
      }
    }

    if (security) {
      if (security.passwordMinLength && security.passwordMinLength < 4) {
        return res.status(400).json({ error: 'Password minimum length cannot be less than 4.' });
      }
      if (security.maxLoginAttempts && security.maxLoginAttempts > 10) {
        return res.status(400).json({ error: 'Max login attempts cannot exceed 10.' });
      }
    }

    // Get current settings
    const currentSettings = await sessionManager.getSession('system_settings') || {};
    
    // Merge with new settings
    const updatedSettings = {
      ...currentSettings,
      system: { ...currentSettings.system, ...system },
      email: { ...currentSettings.email, ...email },
      security: { ...currentSettings.security, ...security },
      features: { ...currentSettings.features, ...features }
    };

    // Cache updated settings
    await sessionManager.setSession('system_settings', updatedSettings);

    res.json({
      message: 'System settings updated successfully',
      settings: updatedSettings
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update system settings.' });
  }
};

// Admin: Get email templates
exports.getEmailTemplates = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const templates = {
      welcomeEmail: {
        subject: 'Welcome to Job Portal - Your Account is Ready! 🎉',
        template: 'welcome_email_template.html',
        variables: ['userName', 'userEmail', 'loginUrl']
      },
      adminReply: {
        subject: 'Response to Your Job Request - Job Portal',
        template: 'admin_reply_template.html',
        variables: ['employerName', 'adminMessage', 'attachmentName']
      },
      employerReply: {
        subject: 'Employer Reply - Job Portal',
        template: 'employer_reply_template.html',
        variables: ['employerName', 'employerEmail', 'employerMessage', 'attachmentName']
      },
      employerRequest: {
        subject: 'New Employer Request - Job Portal',
        template: 'employer_request_template.html',
        variables: ['employerName', 'employerEmail', 'employerMessage']
      }
    };

    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get email templates.' });
  }
};

// Admin: Update email template
exports.updateEmailTemplate = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { templateName, subject, content } = req.body;

    if (!templateName || !subject || !content) {
      return res.status(400).json({ error: 'Template name, subject, and content are required.' });
    }

    // Validate template name
    const validTemplates = ['welcomeEmail', 'adminReply', 'employerReply', 'employerRequest'];
    if (!validTemplates.includes(templateName)) {
      return res.status(400).json({ error: 'Invalid template name.' });
    }

    // Cache the updated template
    await sessionManager.setSession(`email_template_${templateName}`, {
      subject,
      content,
      updatedAt: new Date(),
      updatedBy: req.user.id
    });

    res.json({
      message: 'Email template updated successfully',
      template: {
        name: templateName,
        subject,
        content,
        updatedAt: new Date()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update email template.' });
  }
};

// Admin: Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { type = 'all', page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Get recent user registrations
    const recentRegistrations = await prisma.user.findMany({
      where: {
        role: 'jobseeker',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // Get recent employer requests
    const recentRequests = await prisma.employerRequest.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    // Get recent messages
    const recentMessages = await prisma.message.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      select: {
        id: true,
        fromAdmin: true,
        content: true,
        createdAt: true,
        employerRequest: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    });

    let logs = [];

    if (type === 'all' || type === 'registrations') {
      logs.push(...recentRegistrations.map(user => ({
        type: 'registration',
        id: user.id,
        description: `New job seeker registered: ${user.profile.firstName} ${user.profile.lastName}`,
        email: user.email,
        timestamp: user.createdAt
      })));
    }

    if (type === 'all' || type === 'requests') {
      logs.push(...recentRequests.map(request => ({
        type: 'employer_request',
        id: request.id,
        description: `New employer request from ${request.name}`,
        email: request.email,
        status: request.status,
        timestamp: request.createdAt
      })));
    }

    if (type === 'all' || type === 'messages') {
      logs.push(...recentMessages.map(message => ({
        type: 'message',
        id: message.id,
        description: `${message.fromAdmin ? 'Admin' : 'Employer'} message in request ${message.employerRequest.id}`,
        content: message.content.substring(0, 100),
        timestamp: message.createdAt
      })));
    }

    // Sort by timestamp
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      logs: logs.slice(0, limit),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: logs.length
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get system logs.' });
  }
};

// Admin: Backup system data
exports.backupSystemData = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    // Get all data for backup
    const [users, profiles, categories, requests, messages] = await Promise.all([
      prisma.user.findMany({
        include: {
          profile: true
        }
      }),
      prisma.profile.findMany({
        include: {
          jobCategory: true
        }
      }),
      prisma.jobCategory.findMany(),
      prisma.employerRequest.findMany({
        include: {
          selectedUser: {
            select: {
              id: true,
              email: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      }),
      prisma.message.findMany({
        include: {
          employerRequest: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      })
    ]);

    const backupData = {
      timestamp: new Date(),
      version: '1.0.0',
      data: {
        users,
        profiles,
        categories,
        requests,
        messages
      },
      statistics: {
        totalUsers: users.length,
        totalProfiles: profiles.length,
        totalCategories: categories.length,
        totalRequests: requests.length,
        totalMessages: messages.length
      }
    };

    // Cache backup data
    await sessionManager.setSession('system_backup', backupData);

    res.json({
      message: 'System backup created successfully',
      backup: {
        timestamp: backupData.timestamp,
        statistics: backupData.statistics
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create system backup.' });
  }
}; 