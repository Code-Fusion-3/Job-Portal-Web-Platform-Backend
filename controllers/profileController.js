const { getPrismaClient } = require('../utils/database');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};
const bcrypt = require('bcrypt');
const { sendWelcomeEmail, sendProfileApprovedEmail, sendProfileRejectedEmail } = require('../utils/mailer');

// Helper to resolve uploaded photo path while preserving existing photo when no new file is provided
function resolvePhotoPath(file, existingPhoto) {
  if (file) {
    const filename = file.filename || (file.path ? file.path.split('/').pop() : null);
    if (filename) return `uploads/profiles/${filename}`;
    return file.path || existingPhoto || null;
  }
  return existingPhoto || null;
}

// Get current user's profile (job seeker or admin)
exports.getMyProfile = async (req, res) => {
  try {
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
        maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate, educationLevel, availability, languages, certifications, jobCategoryId } = req.body;

      // Handle photo upload (preserve existing photo if no new one)
      const photoPath = resolvePhotoPath(req.file, user.profile?.photo);

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
            idNumber, contactNumber, maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate: monthlyRate ? monthlyRate.toString() : undefined,
            educationLevel, availability, languages, certifications,
            jobCategoryId: categoryId,
            photo: photoPath,
          },
        });
      } else {
        // Create new profile for admin
        updatedProfile = await prisma.profile.create({
          data: {
            userId,
            firstName, lastName, description, skills, gender,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            idNumber, contactNumber, maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate: monthlyRate ? monthlyRate.toString() : undefined,
            educationLevel, availability, languages, certifications,
            jobCategoryId: categoryId,
            photo: photoPath,
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
      maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate, educationLevel, availability, languages, certifications, jobCategoryId
    } = req.body;

    // Handle photo upload (preserve existing photo if no new one)
    const photoPath = resolvePhotoPath(req.file, user.profile?.photo);

    // Convert jobCategoryId to integer if provided
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : undefined;

    const updatedProfile = await prisma.profile.update({
      where: { userId },
      data: {
        firstName, lastName, description, skills, gender,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        idNumber, contactNumber, maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate: monthlyRate ? monthlyRate.toString() : undefined,
        educationLevel, availability, languages, certifications,
        jobCategoryId: categoryId,
        photo: photoPath,
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
    const {
      email, firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate, educationLevel, availability, languages, certifications, jobCategoryId
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

    const defaultPassword = Math.random().toString(36).slice(-6) + '@' + Math.floor(100 + Math.random() * 900);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : null;
    // Handle photo upload for created job seeker
    const photoPath = resolvePhotoPath(req.file, null);
    
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
            experienceLevel,
            monthlyRate: monthlyRate ? monthlyRate.toString() : null,
            educationLevel,
            availability,
            languages,
            certifications,
            jobCategoryId: categoryId,
            photo: photoPath,
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
        await sendWelcomeEmail(email, firstName, defaultPassword);
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
    const prisma = await initPrisma();
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
    const prisma = await initPrisma();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const gender = req.query.gender || '';
    const location = req.query.location || '';
    const skills = req.query.skills || '';
    
    // Build where clause for filtering - make profile filters truly optional
    const whereClause = {
      role: 'jobseeker'
    };

    // Only add profile filters if they have values AND if we're not being too restrictive
    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { firstName: { contains: search, mode: 'insensitive' } } },
        { profile: { lastName: { contains: search, mode: 'insensitive' } } },
        { profile: { skills: { contains: search, mode: 'insensitive' } } },
        { profile: { location: { contains: search, mode: 'insensitive' } } }
      ];
    }

    // Only add profile-specific filters if they have values
    if (gender) {
      whereClause.profile = { ...whereClause.profile, gender: gender };
    }
    if (location) {
      whereClause.profile = { ...whereClause.profile, location: { contains: location, mode: 'insensitive' } };
    }
    if (skills) {
      whereClause.profile = { ...whereClause.profile, skills: { contains: skills, mode: 'insensitive' } };
    }

    // Build count where clause (same as above)
    const countWhereClause = { ...whereClause };
    
    console.log('🔍 adminGetAllJobSeekers query:', JSON.stringify(whereClause, null, 2));
    
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

    // Log for debugging
    console.log(`🔍 adminGetAllJobSeekers: Found ${users.length} users out of ${total} total`);
    if (users.length > 0) {
      console.log('🔍 First user structure:', JSON.stringify(users[0], null, 2));
    }

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
    console.error('❌ adminGetAllJobSeekers error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch job seekers.' });
  }
};

// Admin: Update any job seeker's profile
exports.adminUpdateJobSeeker = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const userId = parseInt(req.params.id, 10);
    const {
      email, firstName, lastName, description, skills, gender, dateOfBirth, idNumber, contactNumber,
      maritalStatus, location, city, country, references, experience, experienceLevel, monthlyRate, educationLevel, availability, languages, certifications, jobCategoryId
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

    // Handle photo upload (preserve existing photo if no new one)
    const photoPath = resolvePhotoPath(req.file, existingUser.profile?.photo);

    // Check if email is being updated and if it's already taken by another user
    if (email && email !== existingUser.email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail && existingEmail.id !== userId) {
        return res.status(409).json({ error: 'Email already registered by another user.' });
      }
    }

    // Convert jobCategoryId to integer if provided
    const categoryId = jobCategoryId ? parseInt(jobCategoryId, 10) : undefined;

    // Update both user (email) and profile
    const [updatedUser, updatedProfile] = await Promise.all([
      // Update user email if provided
      email !== undefined ? prisma.user.update({
        where: { id: userId },
        data: { email: email || null }
      }) : Promise.resolve(existingUser),
      
      // Update profile
      prisma.profile.update({
        where: { userId },
        data: {
          firstName, lastName, description, skills, gender,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
          idNumber, contactNumber, maritalStatus, location, city, country, references, experience, experienceLevel,
          monthlyRate: monthlyRate ? monthlyRate.toString() : undefined,
          educationLevel, availability, languages, certifications,
          jobCategoryId: categoryId,
          photo: photoPath,
        },
        include: {
          jobCategory: true
        }
      })
    ]);

    res.json({ 
      message: 'Job seeker profile updated successfully', 
      email: updatedUser.email,
      user: updatedUser,
      profile: updatedProfile 
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update job seeker profile.' });
  }
};

// approve profile
exports.approveProfile = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const profileId = parseInt(req.params.id, 10);
    const adminId = req.user.id;
    
    // First, check if the profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { user: true }
    });
    
    if (!existingProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update the profile
    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: {
        approvalStatus: 'approved',
        isActive: true,
        approvedAt: new Date(),
        approvedBy: adminId,
        rejectionReason: null
      },
      include: { user: true }
    });
    
    // ✅ Enhanced error handling for email
    if (profile?.user?.email) {
      try {
        await sendProfileApprovedEmail(profile.user.email, profile.firstName || 'User');
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Continue with approval even if email fails
      }
    }
    
    res.json({ message: 'Profile approved', profile });
  } catch (err) {
    console.error('Profile approval error:', err);
    res.status(500).json({ error: err.message || 'Failed to approve profile.' });
  }
};

// reject profile
exports.rejectProfile = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const profileId = parseInt(req.params.id, 10);
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason required.' });
    }
    
    // First, check if the profile exists
    const existingProfile = await prisma.profile.findUnique({
      where: { id: profileId },
      include: { user: true }
    });
    
    if (!existingProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // Update the profile
    const profile = await prisma.profile.update({
      where: { id: profileId },
      data: {
        approvalStatus: 'rejected',
        isActive: false,
        approvedAt: null,
        approvedBy: null,
        rejectionReason: reason
      },
      include: { user: true }
    });
    
    // ✅ Enhanced error handling for email
    if (profile?.user?.email) {
      try {
        await sendProfileRejectedEmail(profile.user.email, profile.firstName || 'User', reason);
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Continue with rejection even if email fails
      }
    }
    
    res.json({ message: 'Profile rejected', profile });
  } catch (err) {
    console.error('Profile rejection error:', err);
    res.status(500).json({ error: err.message || 'Failed to reject profile.' });
  }
};
// get pending profiles
exports.getPendingProfiles = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const profiles = await prisma.profile.findMany({ where: { approvalStatus: 'pending' } });
    res.json(profiles);
  } catch (err) { 
    res.status(500).json({ error: err.message || 'Failed to fetch pending profiles.' }); 
  }
};
exports.getApprovedProfiles = async (req, res) => {
  try { 
    const prisma = await initPrisma();
    const profiles = await prisma.profile.findMany({ where: { approvalStatus: 'approved' } }); 
    res.json(profiles); 
  } catch (err) { 
    res.status(500).json({ error: err.message || 'Failed to fetch approved profiles.' }); 
  }
};
exports.getRejectedProfiles = async (req, res) => {
  try { 
    const prisma = await initPrisma();
    const profiles = await prisma.profile.findMany({ where: { approvalStatus: 'rejected' } }); 
    res.json(profiles); 
  } catch (err) { 
    res.status(500).json({ error: err.message || 'Failed to fetch rejected profiles.' }); 
  }
};

// Debug endpoint to see what's in the database
exports.debugDatabase = async (req, res) => {
  try {
    const prisma = await initPrisma();
    
    // Get all users with their roles
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            approvalStatus: true
          }
        }
      },
      orderBy: { id: 'asc' }
    });

    // Get all profiles
    const allProfiles = await prisma.profile.findMany({
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        approvalStatus: true
      },
      orderBy: { id: 'asc' }
    });

    // Get users with jobseeker role
    const jobSeekers = await prisma.user.findMany({
      where: { role: 'jobseeker' },
      select: {
        id: true,
        email: true,
        role: true,
        profile: true
      }
    });

    res.json({
      debug: {
        allUsers,
        allProfiles,
        jobSeekers,
        userCount: allUsers.length,
        profileCount: allProfiles.length,
        jobSeekerCount: jobSeekers.length
      }
    });
  } catch (err) {
    console.error('❌ debugDatabase error:', err);
    res.status(500).json({ error: err.message || 'Failed to debug database.' });
  }
};

// Simple test endpoint to debug the basic query
exports.testQuery = async (req, res) => {
  try {
    const prisma = await initPrisma();
    
    // Test 1: Get all users with jobseeker role
    const jobSeekersOnly = await prisma.user.findMany({
      where: { role: 'jobseeker' },
      select: { id: true, email: true, role: true }
    });

    // Test 2: Get all users with jobseeker role and include profiles
    const jobSeekersWithProfiles = await prisma.user.findMany({
      where: { role: 'jobseeker' },
      include: { profile: true }
    });

    // Test 3: Get all users with jobseeker role and profiles (using the same logic as adminGetAllJobSeekers)
    const testQuery = await prisma.user.findMany({
      where: { role: 'jobseeker' },
      include: {
        profile: {
          include: {
            jobCategory: true
          }
        }
      }
    });

    res.json({
      test: {
        jobSeekersOnly,
        jobSeekersWithProfiles,
        testQuery,
        counts: {
          jobSeekersOnly: jobSeekersOnly.length,
          jobSeekersWithProfiles: jobSeekersWithProfiles.length,
          testQuery: testQuery.length
        }
      }
    });
  } catch (err) {
    console.error('❌ testQuery error:', err);
    res.status(500).json({ error: err.message || 'Failed to test query.' });
  }
};
