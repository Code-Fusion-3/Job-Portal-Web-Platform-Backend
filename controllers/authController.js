const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendWelcomeEmail } = require('../utils/mailer');
const prisma = new PrismaClient();

exports.registerJobSeeker = async (req, res) => {
  const { 
    email, 
    password, 
    firstName, 
    lastName, 
    description, 
    skills, 
    gender, 
    dateOfBirth, 
    idNumber, 
    contactNumber,
    maritalStatus,
    location,
    city,
    country,
    references, 
    experience, 
    jobCategoryId 
  } = req.body;
  
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Handle photo upload
    let photoPath = null;
    if (req.file) {
      photoPath = `uploads/profiles/${req.file.filename}`;
    }
    
    // Convert jobCategoryId to integer if provided
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
            photo: photoPath,
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

    // Send welcome email (don't let email failure stop registration)
    try {
      await sendWelcomeEmail(email, firstName);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Continue with registration even if email fails
    }

    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Registration failed.' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    // Find user with profile
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        profile: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    // Return user info (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token
    });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
}; 