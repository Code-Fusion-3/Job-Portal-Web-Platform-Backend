const { PrismaClient } = require("@prisma/client");
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

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
  updateSystemSettings
}; 