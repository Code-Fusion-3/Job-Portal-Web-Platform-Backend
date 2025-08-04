const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { sendWelcomeEmail } = require('../utils/mailer');

// Get current user's profile (job seeker or admin)
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // For admins, return user data even without profile
    if (user.role === 'admin') {
      return res.json(user);
    }

    // For job seekers, require profile
    if (!user.profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch profile.' });
  }
};

// Update current user's profile (job seeker or admin)
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Handle admin profile update
    if (user.role === 'admin') {
      const { email, firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
        maritalStatus, location, city, country, references, experience, monthlyRate, jobCategoryId } = req.body;

      // Check if email is being changed and if it's already taken
      if (email && email !== user.email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          return res.status(409).json({ error: 'Email already registered.' });
        }
      }

      // Convert jobCategoryId to integer if provided
      const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : undefined;

      // Update user email if provided
      if (email) {
        await prisma.user.update({
          where: { id: userId },
          data: { email }
        });
      }

      // Update or create profile for admin
      let updatedProfile;
      if (user.profile) {
        // Update existing profile
        updatedProfile = await prisma.profile.update({
          where: { userId },
          data: {
            firstName, lastName, description, skills, gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            idNumber, contactNumber, maritalStatus, location, city, country, references, experience, monthlyRate,
            jobCategoryId: categoryId,
          },
        });
      } else {
        // Create new profile for admin
        updatedProfile = await prisma.profile.create({
          data: {
            userId,
            firstName, lastName, description, skills, gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            idNumber, contactNumber, maritalStatus, location, city, country, references, experience, monthlyRate,
            jobCategoryId: categoryId,
          },
        });
      }

      return res.json({ 
        message: 'Admin profile updated successfully', 
        profile: updatedProfile 
      });
    }

    // Handle job seeker profile update (existing logic)
    const {
      firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, monthlyRate, jobCategoryId
    } = req.body;

    // Convert jobCategoryId to integer if provided
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : undefined;

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: {
        firstName, lastName, description, skills, gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        idNumber, contactNumber, maritalStatus, location, city, country, references, experience,
        jobCategoryId: categoryId,
      },
    });
    res.json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
};

// Get any profile by user ID (admin only)
exports.getProfileById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        profile: true,
        createdAt: true,
        updatedAt: true,
      }
    });
    if (!user || !user.profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch profile.' });
  }
};

// Delete current user's profile/account (job seeker or admin)
exports.deleteMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // For admins, only delete profile if it exists, don't delete the admin user
    if (user.role === 'admin') {
      if (user.profile) {
        await prisma.profile.delete({ where: { userId } });
        return res.json({ message: 'Admin profile deleted successfully. Admin account preserved.' });
      } else {
        return res.json({ message: 'No profile to delete for admin.' });
      }
    }

    // For job seekers, delete both profile and user
    if (user.profile) {
    await prisma.profile.delete({ where: { userId } });
    }
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Account and profile deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete profile.' });
  }
};

// Admin: Create a job seeker account (worker) with default password
exports.adminCreateJobSeeker = async (req, res) => {
  try {
    const {
      email, firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, monthlyRate, jobCategoryId
    } = req.body;
    
    // Updated validation: contact number required, email optional
    if (!firstName || !lastName || !contactNumber) {
      return res.status(400).json({ error: 'First name, last name, and contact number are required.' });
    }

    // Check if email is provided and if it's already taken
    if (email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Email already registered.' });
      }
    }

    // Check if contact number is already taken
    const existingContact = await prisma.profile.findFirst({ 
      where: { contactNumber } 
    });
    if (existingContact) {
      return res.status(409).json({ error: 'Contact number already registered.' });
    }

    const defaultPassword = 'JobPortal@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : null;
    
    const user = await prisma.user.create({
      data: {
        email: email || null, // Allow null email
        password: hashedPassword,
        role: 'jobseeker',
        profile: {
          create: {
            firstName,
            lastName,
            description,
            skills,
            gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            idNumber,
            contactNumber,
            maritalStatus,
            location,
            city,
            country,
            references,
            experience,
            monthlyRate,
            jobCategoryId: categoryId,
          }
        }
      },
      select: {
        id: true,
        email: true,
        role: true,
        profile: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send welcome email if email is provided
    if (email) {
      try {
        await sendWelcomeEmail(email, firstName);
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
        // Continue even if email fails
      }
    }

    res.status(201).json({ 
      message: 'Job seeker account created successfully', 
      user,
      note: email ? 'Welcome email sent' : 'No email provided - welcome email not sent'
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create job seeker.' });
  }
};

// Admin: Delete any worker (job seeker) by user ID
exports.adminDeleteWorker = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'jobseeker') {
      return res.status(404).json({ error: 'Job seeker not found.' });
    }
    await prisma.profile.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    res.json({ message: 'Job seeker deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete job seeker.' });
  }
};

// Admin: Get all job seekers with pagination
exports.adminGetAllJobSeekers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const gender = req.query.gender || '';
    const location = req.query.location || '';
    const skills = req.query.skills || '';
    
    // Build where clause for filtering
    const whereClause = {
      role: 'jobseeker',
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { firstName: { contains: search, mode: 'insensitive' } } },
          { profile: { lastName: { contains: search, mode: 'insensitive' } } },
          { profile: { skills: { contains: search, mode: 'insensitive' } } },
          { profile: { location: { contains: search, mode: 'insensitive' } } }
        ]
      }),
      ...(gender && { profile: { gender: gender } }),
      ...(location && { profile: { location: { contains: location, mode: 'insensitive' } } }),
      ...(skills && { profile: { skills: { contains: skills, mode: 'insensitive' } } })
    };

    // Build count where clause (same as above but without profile include)
    const countWhereClause = {
      role: 'jobseeker',
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { firstName: { contains: search, mode: 'insensitive' } } },
          { profile: { lastName: { contains: search, mode: 'insensitive' } } },
          { profile: { skills: { contains: search, mode: 'insensitive' } } },
          { profile: { location: { contains: search, mode: 'insensitive' } } }
        ]
      }),
      ...(gender && { profile: { gender: gender } }),
      ...(location && { profile: { location: { contains: location, mode: 'insensitive' } } }),
      ...(skills && { profile: { skills: { contains: skills, mode: 'insensitive' } } })
    };
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          profile: {
            include: {
              jobCategory: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({
        where: countWhereClause
      })
    ]);

    res.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch job seekers.' });
  }
};

// Admin: Update any job seeker's profile
exports.adminUpdateJobSeeker = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const {
      firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, jobCategoryId
    } = req.body;

    // Check if user exists and is a job seeker
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: {
          include: {
            jobCategory: true
          }
        } 
      }
    });

    if (!existingUser || existingUser.role !== 'jobseeker') {
      return res.status(404).json({ error: 'Job seeker not found.' });
    }

    // Convert jobCategoryId to integer if provided
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : undefined;

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: {
        firstName, lastName, description, skills, gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        idNumber, contactNumber, maritalStatus, location, city, country, references, experience,
        jobCategoryId: categoryId,
      },
      include: {
        jobCategory: true
      }
    });

    res.json({ 
      message: 'Job seeker profile updated successfully', 
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update job seeker profile.' });
  }
}; 