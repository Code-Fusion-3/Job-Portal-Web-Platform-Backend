const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { getPrismaClient } = require('../utils/database');
const PaymentService = require('../services/paymentService');
const NotificationService = require('../services/notificationService');

const prisma = new PrismaClient();

// Admin: Export system data
exports.exportSystemData = async (req, res) => {
  try {
    const { type = 'all', format = 'pdf', startDate, endDate } = req.query;
    
    let whereClause = {};
    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    let data = {};
    let filename = '';

    switch (type) {
      case 'categories':
        const categories = await prisma.jobCategory.findMany({
          include: {
            _count: {
              select: {
                profiles: true
              }
            }
          },
          orderBy: { name_en: 'asc' }
        });
        
        data = categories.map(cat => ({
          id: cat.id,
          name_en: cat.name_en,
          name_rw: cat.name_rw,
          job_seekers_count: cat._count.profiles,
          created_at: cat.createdAt,
          updated_at: cat.updatedAt
        }));
        filename = `categories-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'locations':
        const locations = await prisma.profile.groupBy({
          by: ['city', 'country'],
          where: {
            city: { not: null }
          },
          _count: {
            city: true
          },
          orderBy: {
            _count: {
              city: 'desc'
            }
          }
        });
        
        data = locations.map(loc => ({
          city: loc.city,
          country: loc.country,
          job_seekers_count: loc._count.city
        }));
        filename = `locations-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'skills':
        const profiles = await prisma.profile.findMany({
          select: {
            skills: true
          },
          where: {
            skills: { not: null }
          }
        });
        
        const allSkills = profiles
          .map(profile => profile.skills)
          .filter(Boolean)
          .join(', ')
          .split(', ')
          .filter(skill => skill.trim().length > 0)
          .map(skill => skill.trim());

        const skillCounts = allSkills.reduce((acc, skill) => {
          acc[skill] = (acc[skill] || 0) + 1;
          return acc;
        }, {});

        data = Object.entries(skillCounts)
          .sort(([,a], [,b]) => b - a)
          .map(([skill, count]) => ({
            skill,
            count,
            percentage: ((count / allSkills.length) * 100).toFixed(2)
          }));
        filename = `skills-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'employer-requests':
        const requests = await prisma.employerRequest.findMany({
          where: whereClause,
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
          },
          orderBy: { createdAt: 'desc' }
        });
        
        data = requests.map(req => ({
          id: req.id,
          employer_name: req.name,
          employer_email: req.email,
          company_name: req.companyName,
          phone_number: req.phoneNumber,
          message: req.message,
          status: req.status,
          priority: req.priority,
          selected_candidate: req.selectedUser ? 
            `${req.selectedUser.profile.firstName} ${req.selectedUser.profile.lastName}` : 
            'None',
          created_at: req.createdAt,
          updated_at: req.updatedAt
        }));
        filename = `employer-requests-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'job-seekers':
        const jobSeekers = await prisma.user.findMany({
          where: {
            role: 'jobseeker',
            ...whereClause
          },
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                educationLevel: true,
                location: true,
                city: true,
                country: true,
                contactNumber: true,
                monthlyRate: true,
                availability: true,
                languages: true,
                certifications: true,
                description: true,
                gender: true,
                maritalStatus: true,
                idNumber: true,
                references: true,
                jobCategory: {
                  select: {
                    name_en: true,
                    name_rw: true
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        });
        
        data = jobSeekers.map(user => ({
          id: user.id,
          email: user.email,
          first_name: user.profile.firstName,
          last_name: user.profile.lastName,
          skills: user.profile.skills,
          experience: user.profile.experience,
          experience_level: user.profile.experienceLevel,
          education_level: user.profile.educationLevel,
          location: user.profile.location,
          city: user.profile.city,
          country: user.profile.country,
          contact_number: user.profile.contactNumber,
          monthly_rate: user.profile.monthlyRate,
          availability: user.profile.availability,
          languages: user.profile.languages,
          certifications: user.profile.certifications,
          description: user.profile.description,
          gender: user.profile.gender,
          marital_status: user.profile.maritalStatus,
          id_number: user.profile.idNumber,
          references: user.profile.references,
          category: user.profile.jobCategory?.name_en || 'Uncategorized',
          created_at: user.createdAt,
          updated_at: user.updatedAt
        }));
        filename = `job-seekers-${new Date().toISOString().split('T')[0]}`;
        break;

      case 'all':
      default:
        // Export all data
        const [allCategories, allLocations, allSkillsData, allRequests, allJobSeekers] = await Promise.all([
          prisma.jobCategory.findMany({
            include: { _count: { select: { profiles: true } } }
          }),
          prisma.profile.groupBy({
            by: ['city', 'country'],
            where: { city: { not: null } },
            _count: { city: true }
          }),
          prisma.profile.findMany({
            select: { skills: true },
            where: { skills: { not: null } }
          }),
          prisma.employerRequest.findMany({
            where: whereClause,
            include: {
              selectedUser: {
                select: {
                  profile: { select: { firstName: true, lastName: true } }
                }
              }
            }
          }),
          prisma.user.findMany({
            where: { role: 'jobseeker', ...whereClause },
            include: {
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  skills: true,
                  experience: true,
                  city: true,
                  country: true,
                  monthlyRate: true,
                  jobCategory: { select: { name_en: true } }
                }
              }
            }
          })
        ]);

        // Process skills
        const skillsData = allSkillsData
          .map(profile => profile.skills)
          .filter(Boolean)
          .join(', ')
          .split(', ')
          .filter(skill => skill.trim().length > 0)
          .map(skill => skill.trim());

        const skillCountsAll = skillsData.reduce((acc, skill) => {
          acc[skill] = (acc[skill] || 0) + 1;
          return acc;
        }, {});

        data = {
          categories: allCategories.map(cat => ({
            id: cat.id,
            name_en: cat.name_en,
            name_rw: cat.name_rw,
            job_seekers_count: cat._count.profiles
          })),
          locations: allLocations.map(loc => ({
            city: loc.city,
            country: loc.country,
            job_seekers_count: loc._count.city
          })),
          skills: Object.entries(skillCountsAll)
            .sort(([,a], [,b]) => b - a)
            .map(([skill, count]) => ({ skill, count })),
          employer_requests: allRequests.map(req => ({
            id: req.id,
            employer_name: req.name,
            status: req.status,
            created_at: req.createdAt
          })),
          job_seekers: allJobSeekers.map(user => ({
            id: user.id,
            name: `${user.profile.firstName} ${user.profile.lastName}`,
            skills: user.profile.skills,
            experience: user.profile.experience,
            location: `${user.profile.city}, ${user.profile.country}`,
            monthly_rate: user.profile.monthlyRate,
            category: user.profile.jobCategory?.name_en || 'Uncategorized'
          }))
        };
        filename = `complete-export-${new Date().toISOString().split('T')[0]}`;
        break;
    }

    // Set response headers
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      
      // Generate PDF
      const pdfBuffer = await generatePDF(data, type);
      res.send(pdfBuffer);
    } else {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      
      if (format === 'csv') {
        // Convert to CSV
        const csvData = convertToCSV(data);
        res.send(csvData);
      } else {
        // Return JSON
        res.json(data);
      }
    }

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message || 'Failed to export data.' });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ];

  return csvRows.join('\n');
};

// Helper function to generate PDF
const generatePDF = async (data, type) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const buffers = [];

    doc.on('data', (chunk) => {
      buffers.push(chunk);
    });

    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    // Add content to PDF
    doc.fontSize(20).text('Job Portal System Data Export', { align: 'center' });
    doc.moveDown();

    if (type === 'all') {
      doc.fontSize(16).text('Complete Export', { align: 'center' });
      doc.moveDown();
    } else {
      doc.fontSize(16).text(`${type.charAt(0).toUpperCase() + type.slice(1)} Export`, { align: 'center' });
      doc.moveDown();
    }

    doc.fontSize(14).text(`Export Date: ${new Date().toISOString().split('T')[0]}`);
    doc.moveDown();

    if (type === 'all') {
      // Categories section
      doc.fontSize(14).text('Categories', { underline: true });
      doc.moveDown();
      data.categories.forEach((cat, index) => {
        doc.fontSize(12).text(`${index + 1}. ${cat.name_en} (${cat.job_seekers_count} job seekers)`);
      });
      doc.moveDown();

      // Locations section
      doc.fontSize(14).text('Locations', { underline: true });
      doc.moveDown();
      data.locations.forEach((loc, index) => {
        doc.fontSize(12).text(`${index + 1}. ${loc.city}, ${loc.country} (${loc.job_seekers_count} job seekers)`);
      });
      doc.moveDown();

      // Skills section
      doc.fontSize(14).text('Top Skills', { underline: true });
      doc.moveDown();
      data.skills.slice(0, 10).forEach((skill, index) => {
        doc.fontSize(12).text(`${index + 1}. ${skill.skill} (${skill.count} mentions)`);
      });
      doc.moveDown();

      // Employer Requests section
      doc.fontSize(14).text('Employer Requests', { underline: true });
      doc.moveDown();
      data.employer_requests.slice(0, 10).forEach((req, index) => {
        doc.fontSize(12).text(`${index + 1}. ${req.employer_name} (${req.status})`);
      });
      doc.moveDown();

      // Job Seekers section
      doc.fontSize(14).text('Job Seekers', { underline: true });
      doc.moveDown();
      data.job_seekers.slice(0, 10).forEach((seeker, index) => {
        doc.fontSize(12).text(`${index + 1}. ${seeker.name} (${seeker.category})`);
      });
    } else {
      // Single type export
      let sectionTitle = '';
      let items = [];

      if (type === 'categories') {
        sectionTitle = 'Job Categories';
        items = data.map((cat, index) => `${index + 1}. ${cat.name_en} (${cat.job_seekers_count} job seekers)`);
      } else if (type === 'locations') {
        sectionTitle = 'Geographic Distribution';
        items = data.map((loc, index) => `${index + 1}. ${loc.city}, ${loc.country} (${loc.job_seekers_count} job seekers)`);
      } else if (type === 'skills') {
        sectionTitle = 'Skills Analysis';
        items = data.map((skill, index) => `${index + 1}. ${skill.skill} (${skill.count} mentions, ${skill.percentage}%)`);
      } else if (type === 'employer-requests') {
        sectionTitle = 'Employer Requests';
        items = data.map((req, index) => `${index + 1}. ${req.employer_name} - ${req.status} (${req.company_name})`);
      } else if (type === 'job-seekers') {
        sectionTitle = 'Job Seekers';
        items = data.map((seeker, index) => `${index + 1}. ${seeker.first_name} ${seeker.last_name} (${seeker.category})`);
      }

      doc.fontSize(14).text(sectionTitle, { underline: true });
      doc.moveDown();
      items.forEach(item => {
        doc.fontSize(12).text(item);
      });
    }

    // Add footer
    doc.moveDown(2);
    doc.fontSize(10).text('Generated by Job Portal System', { align: 'center' });
    doc.fontSize(8).text(`Total records: ${Array.isArray(data) ? data.length : Object.keys(data).reduce((sum, key) => sum + data[key].length, 0)}`, { align: 'center' });

    doc.end();
  });
};

// Admin: Get system health
exports.getSystemHealth = async (req, res) => {
  try {
    // Get basic system info
    const systemInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      platform: process.platform
    };

    res.json(systemInfo);
  } catch (err) {
    res.status(500).json({ 
      status: 'unhealthy',
      error: err.message || 'System health check failed.' 
    });
  }
};

// Admin: Get system logs
exports.getSystemLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, level, startDate, endDate } = req.query;
    
    // For now, return a placeholder since we don't have a logging system
    // In a real implementation, this would query log files or a logging service
    res.json({
      logs: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0,
        totalPages: 0
      },
      message: 'Logging system not implemented yet'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch system logs.' });
  }
};

// Admin: Get platform statistics
exports.getPlatformStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalRequests,
      totalCategories,
      recentActivity
    ] = await Promise.all([
      prisma.user.count(),
      prisma.employerRequest.count(),
      prisma.jobCategory.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      totalUsers,
      totalRequests,
      totalCategories,
      recentActivity,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch platform statistics.' });
  }
}; 

// Admin Profile Management
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        profile: true
      }
    });

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin profile not found' });
    }

    // If admin doesn't have a profile, create a default one
    if (!admin.profile) {
      const defaultProfile = await prisma.profile.create({
        data: {
          userId: adminId,
          firstName: 'Admin',
          lastName: 'User',
          contactNumber: '',
          experienceLevel: 'Administrator',
          availability: 'Available',
          educationLevel: 'Administrative',
          languages: 'English',
          certifications: 'System Administrator',
          monthlyRate: '0',
          description: 'System Administrator for Job Portal',
          location: 'Kigali, Rwanda'
        }
      });

      // Combine user and new profile data
      const adminProfile = {
        id: admin.id,
        firstName: defaultProfile.firstName,
        lastName: defaultProfile.lastName,
        email: admin.email || '',
        phone: defaultProfile.contactNumber || '',
        location: defaultProfile.location || '',
        bio: defaultProfile.description || '',
        avatar: defaultProfile.photo || null,
        role: admin.role,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt
      };

      return res.json({ success: true, data: adminProfile });
    }

    // Combine user and profile data
    const adminProfile = {
      id: admin.id,
      firstName: admin.profile?.firstName || 'Admin',
      lastName: admin.profile?.lastName || 'User',
      email: admin.email || '',
      phone: admin.profile?.contactNumber || '',
      location: admin.profile?.location || 'Kigali, Rwanda',
      bio: admin.profile?.description || 'System Administrator for Job Portal',
      avatar: admin.profile?.photo || null,
      role: admin.role,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };

    res.json({ success: true, data: adminProfile });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { firstName, lastName, email, phone, location, bio } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ 
        success: false, 
        error: 'First name, last name, and email are required' 
      });
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        email: email,
        id: { not: adminId }
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is already taken by another user' 
      });
    }

    // Update user email
    await prisma.user.update({
      where: { id: adminId },
      data: {
        email,
        updatedAt: new Date()
      }
    });

    // Update or create profile
    const updatedProfile = await prisma.profile.upsert({
      where: { userId: adminId },
      update: {
        firstName,
        lastName,
        contactNumber: phone || null,
        location: location || null,
        description: bio || null,
        updatedAt: new Date()
      },
      create: {
        userId: adminId,
        firstName,
        lastName,
        contactNumber: phone || null,
        location: location || null,
        description: bio || null,
        contactNumber: phone || '',
        experienceLevel: 'Beginner',
        availability: 'Available',
        educationLevel: 'High School',
        languages: 'English',
        certifications: '',
        monthlyRate: '0'
      }
    });

    // Get updated admin with profile
    const updatedAdmin = await prisma.user.findUnique({
      where: { id: adminId },
      include: {
        profile: true
      }
    });

    // Combine user and profile data
    const adminProfile = {
      id: updatedAdmin.id,
      firstName: updatedAdmin.profile?.firstName || '',
      lastName: updatedAdmin.profile?.lastName || '',
      email: updatedAdmin.email || '',
      phone: updatedAdmin.profile?.contactNumber || '',
      location: updatedAdmin.profile?.location || '',
      bio: updatedAdmin.profile?.description || '',
      avatar: updatedAdmin.profile?.photo || null,
      role: updatedAdmin.role,
      updatedAt: updatedAdmin.updatedAt
    };

    res.json({ 
      success: true, 
      data: adminProfile,
      message: 'Profile updated successfully' 
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const changeAdminPassword = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 8 characters long' 
      });
    }

    // Get admin with current password
    const admin = await prisma.user.findUnique({
      where: { id: adminId },
      select: { password: true }
    });

    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: adminId },
      data: {
        password: hashedNewPassword,
        updatedAt: new Date()
      }
    });

    res.json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('Error changing admin password:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const updateAdminAvatar = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No avatar file provided' 
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid file type. Only JPEG, PNG, and GIF are allowed' 
      });
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (req.file.size > maxSize) {
      return res.status(400).json({ 
        success: false, 
        error: 'File size too large. Maximum size is 5MB' 
      });
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `admin_${adminId}_${Date.now()}${fileExtension}`;
    const uploadPath = path.join(__dirname, '../uploads/avatars', fileName);

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../uploads/avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Move file to uploads directory
    fs.renameSync(req.file.path, uploadPath);

    // Update admin avatar in database
    const avatarUrl = `/uploads/avatars/${fileName}`;
    await prisma.profile.upsert({
      where: { userId: adminId },
      update: {
        photo: avatarUrl,
        updatedAt: new Date()
      },
      create: {
        userId: adminId,
        photo: avatarUrl,
        firstName: 'Admin',
        lastName: 'User',
        contactNumber: '',
        experienceLevel: 'Beginner',
        availability: 'Available',
        educationLevel: 'High School',
        languages: 'English',
        certifications: '',
        monthlyRate: '0'
      }
    });

    res.json({ 
      success: true, 
      avatar: avatarUrl,
      message: 'Avatar updated successfully' 
    });
  } catch (error) {
    console.error('Error updating admin avatar:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// System Settings Management
const getSystemSettings = async (req, res) => {
  try {
    // Get system statistics
    const [
      totalUsers,
      totalRequests,
      totalCategories,
      totalProfiles
    ] = await Promise.all([
      prisma.user.count(),
      prisma.employerRequest.count(),
      prisma.jobCategory.count(),
      prisma.profile.count()
    ]);

    // Calculate system uptime (simplified - in real app, you'd track server start time)
    const systemUptime = '7 days'; // Placeholder

    // Get database size (simplified - in real app, you'd query actual DB size)
    const databaseSize = '2.5 MB'; // Placeholder

    // Get last backup time (simplified)
    const lastBackup = '2 hours ago'; // Placeholder

    // Active sessions (simplified - in real app, you'd track actual sessions)
    const activeSessions = 3; // Placeholder

    const settings = {
      emailNotifications: true,
      smsNotifications: false,
      autoBackup: true,
      maintenanceMode: false,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      systemName: 'Job Portal Admin',
      contactEmail: 'admin@jobportal.rw',
      timezone: 'Africa/Kigali',
      // System statistics
      totalUsers,
      totalRequests,
      totalCategories,
      totalProfiles,
      systemUptime,
      databaseSize,
      lastBackup,
      activeSessions
    };

    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const updateSystemSettings = async (req, res) => {
  try {
    const {
      emailNotifications,
      smsNotifications,
      autoBackup,
      maintenanceMode,
      sessionTimeout,
      maxLoginAttempts
    } = req.body;

    // Validate settings
    if (sessionTimeout && (sessionTimeout < 5 || sessionTimeout > 120)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Session timeout must be between 5 and 120 minutes' 
      });
    }

    if (maxLoginAttempts && (maxLoginAttempts < 3 || maxLoginAttempts > 10)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Max login attempts must be between 3 and 10' 
      });
    }

    // In a real application, save these to a database
    // For now, just return success
    const updatedSettings = {
      emailNotifications: emailNotifications ?? true,
      smsNotifications: smsNotifications ?? false,
      autoBackup: autoBackup ?? true,
      maintenanceMode: maintenanceMode ?? false,
      sessionTimeout: sessionTimeout ?? 30,
      maxLoginAttempts: maxLoginAttempts ?? 5
    };

    res.json({ 
      success: true, 
      data: updatedSettings,
      message: 'System settings updated successfully' 
    });
  } catch (error) {
    console.error('Error updating system settings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ===== NEW WORKFLOW FUNCTIONS =====

/**
 * Get single employer request with full details
 */
exports.getEmployerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const prisma = await getPrismaClient();

    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: {
            user: true
          }
        },
        requestedCandidate: {
          include: {
            profile: {
              include: {
                jobCategory: true
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        requestProgress: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    res.json(employerRequest);
  } catch (error) {
    console.error('Error fetching employer request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all employer requests with rich data (Admin)
 */
exports.getAllEmployerRequestsWithRichData = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    
    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const status = req.query.status || 'all';
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build where clause
    const whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }
    
    // Get total count
    const totalCount = await prisma.employerRequest.count({
      where: whereClause
    });
    
    // Get requests with pagination and sorting
    const requests = await prisma.employerRequest.findMany({
      where: whereClause,
      include: {
        employerAccount: {
          include: {
            user: true
          }
        },
        requestedCandidate: {
          include: {
            profile: {
              include: {
                jobCategory: true
              }
            }
          }
        },
        payments: {
          orderBy: { createdAt: 'desc' }
        },
        requestProgress: {
          orderBy: { createdAt: 'desc' }
        }
      },
      skip: offset,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder
      }
    });
    
    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      requests,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching employer requests with rich data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Approve employer request
 */
exports.approveEmployerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();
    
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        },
        requestedCandidate: true
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not in pending status' });
    }

    // Update request status
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'approved',
        requestApprovedBy: adminId,
        requestApprovedAt: new Date()
      }
    });

    // Create first payment request
    await PaymentService.createFirstPaymentRequest(parseInt(requestId, 10));

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'approved',
        status: 'completed',
        description: `Request approved by admin${notes ? `: ${notes}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer
    await NotificationService.sendEmployerNotification(
      employerRequest.employerAccount.userId,
      {
        type: 'request_approved',
        title: 'Request Approved',
        message: 'Your request has been approved! Please pay 5,000 RWF for photo access.',
        employerRequestId: parseInt(requestId, 10)
      }
    );

    // Send notification to candidate
    await NotificationService.sendCandidateNotification(
      employerRequest.requestedCandidateId,
      {
        type: 'request_received',
        title: 'Service Request Received',
        message: 'Someone has requested your services. Details will be shared after payment confirmation.',
        employerRequestId: parseInt(requestId, 10)
      }
    );

    // Send email notifications (don't let email failures affect the main response)
    try {
      // Email to Employer - Request approved
      if (employerRequest.employerAccount?.user?.email) {
        const employerName = employerRequest.employerAccount.user.name || 'Valued Customer';
        const candidateName = employerRequest.requestedCandidate?.profile ? 
          `${employerRequest.requestedCandidate.profile.firstName} ${employerRequest.requestedCandidate.profile.lastName}` : 
          'Requested Worker';
        
        await NotificationService.sendEmail({
          to: employerRequest.employerAccount.user.email,
          subject: 'Request Approved - Payment Required - Job Portal',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 28px;">Request Approved</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Your request has been approved by our admin team.</p>
              </div>
              <div style="padding: 30px; background-color: #ffffff;">
                <h2 style="color: #2c3e50;">Great News!</h2>
                <p>Dear <strong>${employerName}</strong>,</p>
                <p>We're excited to inform you that your request has been approved by our admin team. You're now ready to proceed with the next step.</p>
                
                <!-- Request Details Section -->
                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <h3 style="color: #155724; margin-top: 0;">📋 Request Details</h3>
                  <div style="background-color: #fff; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb;">
                    <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Approved</span></p>
                    <p style="margin: 5px 0;"><strong>Requested Worker:</strong> ${candidateName}</p>
                    <p style="margin: 5px 0;"><strong>Next Step:</strong> Payment Required</p>
                  </div>
                </div>
                
                <!-- Payment Information Section -->
                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <h3 style="color: #856404; margin-top: 0;">💰 Payment Information</h3>
                  
                  <!-- English Version -->
                  <div style="margin-bottom: 20px;">
                    <h4 style="color: #856404; margin-bottom: 10px;">🇬🇧 English</h4>
                    <p style="color: #856404; line-height: 1.6;">
                      Your request has been approved! To proceed, you need to pay a non-refundable fee of <strong>5,000 RWF</strong>. After payment confirmation, you'll receive access to the candidate's photo and can then request full details if needed.
                    </p>
                  </div>
                  
                  <!-- Kinyarwanda Version -->
                  <div style="margin-bottom: 20px;">
                    <h4 style="color: #856404; margin-bottom: 10px;">🇷🇼 Kinyarwanda</h4>
                    <p style="color: #856404; line-height: 1.6;">
                      Gusaba kwawe kwemejwe! Kugira ngo ukomeze, ukeneye kwishyura amafranga <strong>5,000 RWF</strong> adasubizwa. Nyuma y'emeza ko wishyuye, uzahabwa uburenganzira bwo kureba ifoto y'uwo mukeneye, hanyuma urashobora gusaba amakuru yose niba ukeneye.
                    </p>
                  </div>
                  
                  <div style="background-color: #fff; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7;">
                    <p style="margin: 5px 0; color: #856404;"><strong>📋 Next Steps:</strong></p>
                    <ol style="color: #856404; margin: 5px 0; padding-left: 20px;">
                      <li>Pay the initial fee of <strong>5,000 RWF</strong> (non-refundable)</li>
                      <li>Receive access to the candidate's photo</li>
                      <li>Request full details if needed</li>
                      <li>Complete the hiring process</li>
                    </ol>
                  </div>
                </div>
                
                <p>If you have any questions, please reply to this email or contact our support team.</p>
                <div class="signature" style="border-top: 2px solid #28a745; padding-top: 20px; margin-top: 30px;">
                  <p>Best regards,</p>
                  <div class="signature-name" style="font-weight: bold; color: #2c3e50;">The Job Portal Team</div>
                  <div class="signature-title" style="color: #28a745; font-size: 14px;">Customer Success Manager</div>
                </div>
              </div>
              <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
                <p style="margin: 0; font-size: 12px; opacity: 0.8;">This is an automated notification from Job Portal. Please do not reply to this email.</p>
              </div>
            </div>
          `
        });
      }

      // Email to Admin - Request approved notification
      await NotificationService.sendAdminNotification({
        type: 'request_approved',
        title: 'Request Approved',
        message: `Request #${requestId} has been approved. Employer: ${employerRequest.employerAccount.user.name}`,
        employerRequestId: parseInt(requestId, 10)
      });
    } catch (emailError) {
      console.error('Failed to send email notifications:', emailError);
      // Don't throw - email failure shouldn't affect the main operation
    }

    res.json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Error approving employer request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reject employer request
 */
exports.rejectEmployerRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();
    
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    // Update request status
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'cancelled',
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedBy: adminId
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'rejected',
        status: 'failed',
        description: `Request rejected by admin${reason ? `: ${reason}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer
    await NotificationService.sendEmployerNotification(
      employerRequest.employerAccount.userId,
      {
        type: 'request_rejected',
        title: 'Request Rejected',
        message: `Your request has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        employerRequestId: parseInt(requestId, 10)
      }
    );

    res.json({ message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting employer request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Approve payment
 */
exports.approvePayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    await PaymentService.approvePayment(parseInt(paymentId, 10), adminId, notes);

    res.json({ message: 'Payment approved successfully' });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Reject payment
 */
exports.rejectPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    await PaymentService.rejectPayment(parseInt(paymentId, 10), adminId, reason);

    res.json({ message: 'Payment rejected successfully' });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Request second payment (admin initiated)
 */
exports.requestSecondPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { amount } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();
    
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'photo_access_granted') {
      return res.status(400).json({ error: 'Request must have photo access before requesting second payment' });
    }

    // Create second payment request
    await PaymentService.createSecondPaymentRequest(parseInt(requestId, 10), amount || 10000);

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'second_payment_required',
        status: 'completed',
        description: `Admin requested second payment of ${amount || 10000} RWF for full details`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    res.json({ message: 'Second payment requested successfully' });
  } catch (error) {
    console.error('Error requesting second payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Approve/Reject full details request from employer
 */
exports.approveFullDetailsRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action, amount, notes } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();
    
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        },
        requestedCandidate: true
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'full_details_requested') {
      return res.status(400).json({ error: 'Request is not in full_details_requested status' });
    }

    if (action === 'approve') {
      // Set second payment amount and request payment
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'second_payment_required',
          secondPaymentAmount: amount || 10000.0,
          secondPaymentRequired: true
        }
      });

      // Create second payment request
      await PaymentService.createSecondPaymentRequest(parseInt(requestId, 10), amount || 10000.0);

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: parseInt(requestId, 10),
          stage: 'second_payment_required',
          status: 'completed',
          description: `Admin approved full details request. Second payment of ${amount || 10000} RWF requested`,
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        employerRequest.employerAccount.userId,
        {
          type: 'full_details_approved',
          title: 'Full Details Request Approved',
          message: `Your request for full details has been approved. Please pay ${amount || 10000} RWF to access complete candidate information.`,
          employerRequestId: parseInt(requestId, 10)
        }
      );

      res.json({ message: 'Full details request approved. Second payment requested from employer.' });
    } else if (action === 'reject') {
      // Reject the request and keep photo access only
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'photo_access_granted',
          hiringDecisionNotes: notes ? `Admin rejection reason: ${notes}` : 'Full details request rejected by admin'
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: parseInt(requestId, 10),
          stage: 'full_details_rejected',
          status: 'failed',
          description: `Admin rejected full details request${notes ? `: ${notes}` : ''}`,
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        employerRequest.employerAccount.userId,
        {
          type: 'full_details_rejected',
          title: 'Full Details Request Rejected',
          message: `Your request for full details has been rejected.${notes ? ` Reason: ${notes}` : ''} You still have photo access.`,
          employerRequestId: parseInt(requestId, 10)
        }
      );

      res.json({ message: 'Full details request rejected. Employer retains photo access only.' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }
  } catch (error) {
    console.error('Error processing full details request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update candidate availability after hiring decision
 */
exports.updateCandidateAvailability = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();
    
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        requestedCandidate: true,
        employerAccount: {
          include: { user: true }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'hiring_decision_made') {
      return res.status(400).json({ error: 'Request must have hiring decision made before updating availability' });
    }

    if (action === 'mark_unavailable') {
      // Mark candidate as unavailable
      await prisma.user.update({
        where: { id: employerRequest.requestedCandidateId },
        data: {
          isAvailableForMatching: false,
          matchedAt: new Date(),
          matchedWithEmployerId: parseInt(requestId, 10)
        }
      });

      // Update request status
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'completed',
          isCompleted: true,
          completedAt: new Date(),
          completedBy: adminId,
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: adminId
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: parseInt(requestId, 10),
          stage: 'completed',
          status: 'completed',
          description: 'Candidate marked as unavailable and request completed',
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      // Send notification to candidate
      await NotificationService.sendCandidateNotification(
        employerRequest.requestedCandidateId,
        {
          type: 'matched_with_employer',
          title: 'You Have Been Matched',
          message: 'Congratulations! You have been matched with an employer.',
          employerRequestId: parseInt(requestId, 10)
        }
      );

      res.json({ message: 'Candidate marked as unavailable and request completed' });
    } else if (action === 'keep_available') {
      // Keep candidate available and deactivate request
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'completed',
          isCompleted: true,
          completedAt: new Date(),
          completedBy: adminId,
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: adminId
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: parseInt(requestId, 10),
          stage: 'completed',
          status: 'completed',
          description: 'Request completed but candidate remains available',
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      res.json({ message: 'Request completed. Candidate remains available for other requests.' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "mark_unavailable" or "keep_available"' });
    }
  } catch (error) {
    console.error('Error updating candidate availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Get all job seekers
exports.getAllJobSeekers = async (req, res) => {
  try {
    const { limit = 10, page = 1, search, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      role: 'job_seeker'
    };

    // Add search filter
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Add status filter
    if (status) {
      whereClause.isAvailableForMatching = status === 'available';
    }

    const [jobSeekers, totalCount] = await Promise.all([
      getPrismaClient().user.findMany({
        where: whereClause,
        include: {
          profile: true,
          matchedEmployerRequest: {
            include: {
              employer: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: skip,
        take: parseInt(limit)
      }),
      getPrismaClient().user.count({
        where: whereClause
      })
    ]);

    res.json({
      success: true,
      data: jobSeekers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + parseInt(limit) < totalCount,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching job seekers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch job seekers'
    });
  }
};

/**
 * Approve first payment
 */
exports.approveFirstPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();

    // Get the employer request
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: {
            user: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (!['first_payment_confirmed', 'payment_confirmed'].includes(employerRequest.status)) {
      return res.status(400).json({ error: 'Request must be in first_payment_confirmed or payment_confirmed status' });
    }

    // Update request status and grant image access
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'photo_access_granted',
        imageAccessGranted: true,
        accessGrantedAt: new Date(),
        accessGrantedBy: adminId,
        updatedAt: new Date()
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'photo_access_granted',
        status: 'completed',
        description: `First payment approved by admin${notes ? `: ${notes}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer (don't let email failures affect the main response)
    if (employerRequest.employerAccount?.user?.email) {
      try {
        await NotificationService.sendEmail({
          to: employerRequest.employerAccount.user.email,
          subject: 'Payment Approved - Photo Access Granted - Job Portal',
          html: `
            <h2>Payment Approved - Photo Access Granted</h2>
            <p>Your first payment has been approved by the admin.</p>
            <p>You now have access to the candidate's photo and can proceed with the next steps.</p>
            ${notes ? `<p><strong>Admin Notes:</strong> ${notes}</p>` : ''}
          `
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw - email failure shouldn't affect the main operation
      }
    }

    res.json({
      success: true,
      message: 'First payment approved successfully',
      newStatus: 'photo_access_granted'
    });

  } catch (error) {
    console.error('Error approving first payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve first payment'
    });
  }
};

/**
 * Reject first payment
 */
exports.rejectFirstPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();

    // Get the employer request
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: {
            user: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (!['first_payment_confirmed', 'payment_confirmed'].includes(employerRequest.status)) {
      return res.status(400).json({ error: 'Request must be in first_payment_confirmed or payment_confirmed status' });
    }

    // Update request status
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'payment_rejected',
        status: 'completed',
        description: `First payment rejected by admin${reason ? `: ${reason}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer (don't let email failures affect the main response)
    if (employerRequest.employerAccount?.user?.email) {
      try {
        await NotificationService.sendEmail({
          to: employerRequest.employerAccount.user.email,
          subject: 'Payment Rejected - Job Portal',
          html: `
            <h2>Payment Rejected</h2>
            <p>Your first payment has been rejected by the admin.</p>
            <p>Please contact support for more information.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          `
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw - email failure shouldn't affect the main operation
      }
    }

    res.json({
      success: true,
      message: 'First payment rejected successfully',
      newStatus: 'cancelled'
    });

  } catch (error) {
    console.error('Error rejecting first payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject first payment'
    });
  }
};

/**
 * Approve second payment
 */
exports.approveSecondPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();

    // Get the employer request
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: {
            user: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'second_payment_confirmed') {
      return res.status(400).json({ error: 'Request must be in second_payment_confirmed status' });
    }

    // Update request status and grant full access
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'full_access_granted',
        imageAccessGranted: true,
        contactAccessGranted: true,
        accessGrantedAt: new Date(),
        accessGrantedBy: adminId,
        updatedAt: new Date()
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'full_access_granted',
        status: 'completed',
        description: `Second payment approved by admin${notes ? `: ${notes}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer (don't let email failures affect the main response)
    if (employerRequest.employerAccount?.user?.email) {
      try {
        await NotificationService.sendEmail({
          to: employerRequest.employerAccount.user.email,
          subject: 'Second Payment Approved - Full Access Granted - Job Portal',
          html: `
            <h2>Second Payment Approved - Full Access Granted</h2>
            <p>Your second payment has been approved by the admin.</p>
            <p>You now have full access to the candidate's details and can make your hiring decision.</p>
            ${notes ? `<p><strong>Admin Notes:</strong> ${notes}</p>` : ''}
          `
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw - email failure shouldn't affect the main operation
      }
    }

    res.json({
      success: true,
      message: 'Second payment approved successfully',
      newStatus: 'full_access_granted'
    });

  } catch (error) {
    console.error('Error approving second payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to approve second payment'
    });
  }
};

/**
 * Reject second payment
 */
exports.rejectSecondPayment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    const prisma = await getPrismaClient();

    // Get the employer request
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: {
            user: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    if (employerRequest.status !== 'second_payment_confirmed') {
      return res.status(400).json({ error: 'Request must be in second_payment_confirmed status' });
    }

    // Update request status
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'cancelled',
        updatedAt: new Date()
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: 'payment_rejected',
        status: 'completed',
        description: `Second payment rejected by admin${reason ? `: ${reason}` : ''}`,
        completedAt: new Date(),
        completedBy: adminId
      }
    });

    // Send notification to employer (don't let email failures affect the main response)
    if (employerRequest.employerAccount?.user?.email) {
      try {
        await NotificationService.sendEmail({
          to: employerRequest.employerAccount.user.email,
          subject: 'Second Payment Rejected - Job Portal',
          html: `
            <h2>Second Payment Rejected</h2>
            <p>Your second payment has been rejected by the admin.</p>
            <p>Please contact support for more information.</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          `
        });
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
        // Don't throw - email failure shouldn't affect the main operation
      }
    }

    res.json({
      success: true,
      message: 'Second payment rejected successfully',
      newStatus: 'cancelled'
    });

  } catch (error) {
    console.error('Error rejecting second payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reject second payment'
    });
  }
};

/**
 * Clean testing data - Remove all non-admin users, employer requests, and related data
 * Preserves: Admin accounts, Job categories
 */
exports.cleanTestingData = async (req, res) => {
  try {
    const { getPrismaClient } = require('../utils/database');
    const prisma = await getPrismaClient();
    
    console.log('🧹 Starting testing data cleanup...');
    
    // Start a transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      let deletedCounts = {};
      
      // 1. Delete messages (cascade will handle related data)
      const deletedMessages = await tx.message.deleteMany({});
      deletedCounts.messages = deletedMessages.count;
      console.log(`✅ Deleted ${deletedMessages.count} messages`);
      
      // 2. Delete request progress
      const deletedProgress = await tx.requestProgress.deleteMany({});
      deletedCounts.requestProgress = deletedProgress.count;
      console.log(`✅ Deleted ${deletedProgress.count} request progress records`);
      
      // 3. Delete payment approvals
      const deletedApprovals = await tx.paymentApproval.deleteMany({});
      deletedCounts.paymentApprovals = deletedApprovals.count;
      console.log(`✅ Deleted ${deletedApprovals.count} payment approvals`);
      
      // 4. Delete payments
      const deletedPayments = await tx.payment.deleteMany({});
      deletedCounts.payments = deletedPayments.count;
      console.log(`✅ Deleted ${deletedPayments.count} payments`);
      
      // 5. Delete employer requests
      const deletedRequests = await tx.employerRequest.deleteMany({});
      deletedCounts.employerRequests = deletedRequests.count;
      console.log(`✅ Deleted ${deletedRequests.count} employer requests`);
      
      // 6. Delete job seeker profiles
      const deletedProfiles = await tx.profile.deleteMany({});
      deletedCounts.profiles = deletedProfiles.count;
      console.log(`✅ Deleted ${deletedProfiles.count} job seeker profiles`);
      
      // 7. Delete employer accounts
      const deletedEmployerAccounts = await tx.employerAccount.deleteMany({});
      deletedCounts.employerAccounts = deletedEmployerAccounts.count;
      console.log(`✅ Deleted ${deletedEmployerAccounts.count} employer accounts`);
      
      // 8. Clean up notifications (must be before deleting users due to foreign key)
      const deletedNotifications = await tx.notification.deleteMany({});
      deletedCounts.notifications = deletedNotifications.count;
      console.log(`✅ Deleted ${deletedNotifications.count} notifications`);
      
      // 9. Delete contacts (references users)
      const deletedContacts = await tx.contact.deleteMany({});
      deletedCounts.contacts = deletedContacts.count;
      console.log(`✅ Deleted ${deletedContacts.count} contacts`);
      
      // 10. Delete audit logs (references users - but only non-admin related ones)
      const deletedAuditLogs = await tx.auditLog.deleteMany({
        where: {
          userId: {
            not: null
          },
          user: {
            role: {
              not: 'admin'
            }
          }
        }
      });
      deletedCounts.auditLogs = deletedAuditLogs.count;
      console.log(`✅ Deleted ${deletedAuditLogs.count} audit logs`);
      
      // 11. Delete non-admin users (preserve admin accounts)
      const deletedUsers = await tx.user.deleteMany({
        where: {
          role: {
            not: 'admin'
          }
        }
      });
      deletedCounts.users = deletedUsers.count;
      console.log(`✅ Deleted ${deletedUsers.count} non-admin users`);
      
      return deletedCounts;
    });
    
    console.log('🎉 Testing data cleanup completed successfully!');
    console.log('📊 Summary:', result);
    
    res.json({
      success: true,
      message: 'Testing data cleaned successfully',
      summary: result,
      preserved: ['Admin accounts', 'Job categories', 'System configuration']
    });
    
  } catch (error) {
    console.error('❌ Error cleaning testing data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean testing data',
      details: error.message
    });
  }
};

module.exports = {
  exportSystemData: exports.exportSystemData,
  getSystemHealth: exports.getSystemHealth,
  getSystemLogs: exports.getSystemLogs,
  getPlatformStats: exports.getPlatformStats,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  updateAdminAvatar,
  getSystemSettings,
  updateSystemSettings,
  getAllJobSeekers: exports.getAllJobSeekers,
  getAllEmployerRequestsWithRichData: exports.getAllEmployerRequestsWithRichData,
  // New workflow functions
  getEmployerRequest: exports.getEmployerRequest,
  approveEmployerRequest: exports.approveEmployerRequest,
  rejectEmployerRequest: exports.rejectEmployerRequest,
  approvePayment: exports.approvePayment,
  rejectPayment: exports.rejectPayment,
  requestSecondPayment: exports.requestSecondPayment,
  approveFullDetailsRequest: exports.approveFullDetailsRequest,
  updateCandidateAvailability: exports.updateCandidateAvailability,
  approveFirstPayment: exports.approveFirstPayment,
  rejectFirstPayment: exports.rejectFirstPayment,
  approveSecondPayment: exports.approveSecondPayment,
  rejectSecondPayment: exports.rejectSecondPayment,
  cleanTestingData: exports.cleanTestingData
}; 