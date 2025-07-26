const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');
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
            jobCategoryId,
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