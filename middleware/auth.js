const jwt = require('jsonwebtoken');
const { getPrismaClient } = require('../utils/database');

let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const prisma = await initPrisma();
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    // Handle different user types
    if (decoded.role === 'employer') {
      // For employers, get account details
      const employerAccount = await prisma.employerAccount.findUnique({
        where: { id: decoded.accountId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      });

      if (!employerAccount) {
        return res.status(401).json({ error: 'Employer account not found' });
      }

      req.user = {
        ...decoded,
        id: employerAccount.user.id,
        email: employerAccount.user.email,
        name: employerAccount.user.name,
        accountId: employerAccount.id,
        companyName: employerAccount.companyName,
        phoneNumber: employerAccount.phoneNumber
      };
    } else {
      // For regular users (admin, jobseeker)
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          role: true,
          profile: true,
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      req.user = user;
    }

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Middleware to check if user is job seeker
const requireJobSeeker = (req, res, next) => {
  if (req.user.role !== 'jobseeker') {
    return res.status(403).json({ error: 'Job seeker access required' });
  }
  next();
};

// Middleware to check if user is employer
const requireEmployer = (req, res, next) => {
  if (req.user.role !== 'employer') {
    return res.status(403).json({ error: 'Employer access required' });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireJobSeeker,
  requireEmployer
}; 