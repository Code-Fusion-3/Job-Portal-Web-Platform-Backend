const { getPrismaClient } = require('../utils/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { generateRandomPassword } = require('../utils/passwordGenerator');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Create employer account when submitting request (auto-registration)
exports.createEmployerAccount = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { name, email, phoneNumber, companyName } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Check if employer account already exists
    const existingAccount = await prisma.employerAccount.findUnique({
      where: { email }
    });

    if (existingAccount) {
      return res.status(409).json({ 
        error: 'Employer account already exists with this email.',
        accountId: existingAccount.id
      });
    }

    // Generate random password in abc@123 format
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    // Create user record
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'employer'
      }
    });

    // Create employer account
    const employerAccount = await prisma.employerAccount.create({
      data: {
        userId: user.id,
        phoneNumber,
        companyName
      }
    });

    res.status(201).json({
      message: 'Employer account created successfully',
      account: {
        id: employerAccount.id,
        email: employerAccount.email,
        name: employerAccount.name,
        companyName: employerAccount.companyName
      },
      loginCredentials: {
        email,
        password: randomPassword,
        message: 'Please save these credentials. You can change your password after first login.'
      }
    });

  } catch (err) {
    console.error('Create employer account error:', err);
    res.status(500).json({ error: err.message || 'Failed to create employer account.' });
  }
};

// Employer login
exports.employerLogin = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find employer account
    const employerAccount = await prisma.employerAccount.findUnique({
      where: { 
        user: { email } 
      },
      include: { user: true }
    });

    if (!employerAccount) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Check if account is active
    if (!employerAccount.isActive) {
      return res.status(401).json({ error: 'Account is deactivated. Please contact admin.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, employerAccount.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    await prisma.employerAccount.update({
      where: { id: employerAccount.id },
      data: { lastLoginAt: new Date() }
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: employerAccount.userId, 
        accountId: employerAccount.id,
        email: employerAccount.email,
        role: 'employer' 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      employer: {
        id: employerAccount.id,
        name: employerAccount.user.name,
        email: employerAccount.user.email,
        companyName: employerAccount.companyName,
        phoneNumber: employerAccount.phoneNumber
      }
    });

  } catch (err) {
    console.error('Employer login error:', err);
    res.status(500).json({ error: err.message || 'Failed to login.' });
  }
};

// Change employer password
exports.changePassword = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { currentPassword, newPassword } = req.body;
    const accountId = req.user.accountId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    // Find employer account
    const employerAccount = await prisma.employerAccount.findUnique({
      where: { id: accountId }
    });

    if (!employerAccount) {
      return res.status(404).json({ error: 'Employer account not found.' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, employerAccount.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in both tables
    await Promise.all([
      prisma.employerAccount.update({
        where: { id: accountId },
        data: { password: hashedNewPassword }
      }),
      prisma.user.update({
        where: { id: employerAccount.userId },
        data: { password: hashedNewPassword }
      })
    ]);

    res.json({ message: 'Password changed successfully' });

  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: err.message || 'Failed to change password.' });
  }
};

// Get employer profile
exports.getEmployerProfile = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const accountId = req.user.accountId;

    const employerAccount = await prisma.employerAccount.findUnique({
      where: { id: accountId },
      include: {
        employerRequests: {
          include: {
            requestedCandidate: {
              include: { profile: true }
            },
            payments: {
              orderBy: { createdAt: 'desc' },
              take: 1
            },
            requestProgress: {
              orderBy: { createdAt: 'desc' },
              take: 5
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!employerAccount) {
      return res.status(404).json({ error: 'Employer account not found.' });
    }

    res.json({
      employer: {
        id: employerAccount.id,
        name: employerAccount.user.name,
        email: employerAccount.user.email,
        companyName: employerAccount.companyName,
        phoneNumber: employerAccount.phoneNumber,
        isActive: employerAccount.isActive,
        lastLoginAt: employerAccount.lastLoginAt,
        createdAt: employerAccount.createdAt
      },
      requests: employerAccount.employerRequests.map(request => ({
        id: request.id,
        message: request.message,
        priority: request.priority,
        status: request.status,
        createdAt: request.createdAt,
        requestedCandidate: request.requestedCandidate ? {
          name: `${request.requestedCandidate.profile?.firstName} ${request.requestedCandidate.profile?.lastName}`,
          skills: request.requestedCandidate.profile?.skills,
          experience: request.requestedCandidate.profile?.experience
        } : null,
        paymentInfo: request.payments[0] ? {
          amount: request.payments[0].amount,
          currency: request.payments[0].currency,
          status: request.payments[0].status
        } : null,
        latestProgress: request.requestProgress[0] ? {
          stage: request.requestProgress[0].stage,
          description: request.requestProgress[0].description,
          completedAt: request.requestProgress[0].completedAt
        } : null
      }))
    });

  } catch (err) {
    console.error('Get employer profile error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch employer profile.' });
  }
};

// Update employer profile
exports.updateEmployerProfile = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const accountId = req.user.accountId;
    const { name, phoneNumber, companyName } = req.body;

    // Update both user and employer account
    const [updatedUser, updatedAccount] = await Promise.all([
      prisma.user.update({
        where: { id: req.user.userId },
        data: {
          name: name || undefined
        }
      }),
      prisma.employerAccount.update({
        where: { id: accountId },
        data: {
          phoneNumber: phoneNumber || undefined,
          companyName: companyName || undefined
        }
      })
    ]);

    res.json({
      message: 'Profile updated successfully',
      employer: {
        id: updatedAccount.id,
        name: updatedUser.name,
        email: updatedUser.email,
        companyName: updatedAccount.companyName,
        phoneNumber: updatedAccount.phoneNumber
      }
    });

  } catch (err) {
    console.error('Update employer profile error:', err);
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
};

// Forgot password (reset to default)
exports.forgotPassword = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Find employer account by user email
    const employerAccount = await prisma.employerAccount.findFirst({
      where: { 
        user: { email } 
      },
      include: { user: true }
    });

    if (!employerAccount) {
      return res.status(404).json({ error: 'Employer account not found.' });
    }

    // Generate new random password in abc@123 format
    const newRandomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newRandomPassword, 10);

    // Update password in both tables
    await Promise.all([
      prisma.employerAccount.update({
        where: { id: employerAccount.id },
        data: { password: hashedPassword }
      }),
      prisma.user.update({
        where: { id: employerAccount.userId },
        data: { password: hashedPassword }
      })
    ]);

    res.json({
      message: 'Password reset successfully',
      newPassword: newRandomPassword,
      note: 'Please save this new password and change it after login.'
    });

  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message || 'Failed to reset password.' });
  }
};
