const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const bcrypt = require('bcrypt');
const { sendWelcomeEmail } = require('../utils/mailer');

// Get current user's profile (job seeker)
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
    if (!user || !user.profile) {
      return res.status(404).json({ error: 'Profile not found.' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch profile.' });
  }
};

// Update current user's profile (job seeker)
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, jobCategoryId
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

// Delete current user's profile/account (job seeker)
exports.deleteMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    // Delete profile and user
    await prisma.profile.delete({ where: { userId } });
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
      maritalStatus, location, city, country, references, experience, jobCategoryId
    } = req.body;
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, firstName, and lastName are required.' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    const defaultPassword = 'JobPortal@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : null;
    const user = await prisma.user.create({
      data: {
        email,
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
    // Send welcome email with default password
    try {
      await sendWelcomeEmail(email, firstName);
    } catch (emailError) {
      // Continue even if email fails
    }
    res.status(201).json({ message: 'Job seeker account created', user });
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
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'jobseeker' },
        include: {
          profile: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({
        where: { role: 'jobseeker' }
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
      include: { profile: true }
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
    });

    res.json({ 
      message: 'Job seeker profile updated successfully', 
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update job seeker profile.' });
  }
}; 