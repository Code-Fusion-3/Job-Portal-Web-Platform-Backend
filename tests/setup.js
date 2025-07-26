// Test setup file for Jest
const { PrismaClient } = require('../generated/prisma');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
process.env.GMAIL_USER = 'test@example.com';
process.env.GMAIL_APP_PASSWORD = 'test-password';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test setup
beforeAll(async () => {
  // Initialize Prisma client for tests
  global.prisma = new PrismaClient();
  
  // Connect to test database
  await global.prisma.$connect();
  
  // Clean up test data
  await cleanupTestData();
});

// Global test teardown
afterAll(async () => {
  // Clean up test data
  await cleanupTestData();
  
  // Disconnect Prisma
  await global.prisma.$disconnect();
});

// Clean up test data function
async function cleanupTestData() {
  try {
    // Delete test users (excluding admin)
    await global.prisma.user.deleteMany({
      where: {
        email: {
          in: [
            'test@example.com',
            'test2@example.com',
            'admin-created@example.com',
            'to-delete@example.com',
            'self-delete@example.com',
            'duplicate@example.com'
          ]
        }
      }
    });

    // Delete test employer requests
    await global.prisma.employerRequest.deleteMany({
      where: {
        email: {
          in: [
            'test-employer@example.com',
            'test-employer2@example.com'
          ]
        }
      }
    });

    // Delete test job categories (excluding seeded ones)
    await global.prisma.jobCategory.deleteMany({
      where: {
        name_en: {
          in: [
            'Test Category',
            'Test Category 2'
          ]
        }
      }
    });
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}

// Mock Redis for tests
jest.mock('../utils/redis', () => ({
  redisClient: {
    on: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn()
  },
  messageCache: {
    cacheMessage: jest.fn(),
    getCachedMessage: jest.fn(),
    cacheConversation: jest.fn(),
    getCachedConversation: jest.fn()
  },
  realTimeMessaging: {
    setUserOnline: jest.fn(),
    getUserSocket: jest.fn(),
    setUserOffline: jest.fn(),
    publishMessage: jest.fn(),
    incrementUnreadCount: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn()
  },
  sessionManager: {
    setSession: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn()
  },
  rateLimiter: {
    checkRateLimit: jest.fn()
  }
}));

// Mock Nodemailer for tests
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
  }))
}));

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn()
  }
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  extname: jest.fn((filename) => {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '';
  })
}));

// Global test utilities
global.testUtils = {
  // Create test user data
  createTestUserData: (overrides = {}) => ({
    email: 'test@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe',
    description: 'Test user description',
    skills: 'JavaScript, React, Node.js',
    gender: 'Male',
    dateOfBirth: '1990-01-01',
    idNumber: '1234567890123456',
    contactNumber: '+250788123456',
    maritalStatus: 'Single',
    location: 'Kigali, Rwanda',
    city: 'Kigali',
    country: 'Rwanda',
    references: 'Available upon request',
    experience: '5 years',
    jobCategoryId: 1,
    ...overrides
  }),

  // Create test employer request data
  createTestEmployerRequestData: (overrides = {}) => ({
    name: 'Test Employer',
    email: 'test-employer@example.com',
    message: 'Test employer request message',
    ...overrides
  }),

  // Create test job category data
  createTestJobCategoryData: (overrides = {}) => ({
    name_en: 'Test Category',
    name_rw: 'Test Category Rw',
    ...overrides
  }),

  // Generate test JWT token
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    const defaultPayload = {
      userId: 1,
      email: 'test@example.com',
      role: 'jobseeker',
      ...payload
    };
    return jwt.sign(defaultPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
  },

  // Generate admin JWT token
  generateAdminToken: () => {
    const jwt = require('jsonwebtoken');
    const payload = {
      userId: 1,
      email: 'admin@jobportal.com',
      role: 'admin'
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
  }
};

// Increase timeout for database operations
jest.setTimeout(30000); 