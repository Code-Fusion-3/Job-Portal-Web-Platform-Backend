const request = require('supertest');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Mock the app
const app = express();
app.use(express.json());

// Mock middleware
const mockAuthenticateToken = (req, res, next) => {
  req.user = { id: 1, role: 'admin' };
  next();
};

const mockRequireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn()
  },
  profile: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    delete: jest.fn()
  }
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

// Test admin profile management
describe('Admin Profile Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Admin can get their profile even without a profile record', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@test.com',
      role: 'admin',
      profile: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const response = await request(app)
      .get('/profile/me')
      .set('Authorization', 'Bearer test-token')
      .use(mockAuthenticateToken);

    expect(response.status).toBe(200);
    expect(response.body.role).toBe('admin');
  });

  test('Admin can update their profile and create profile if it does not exist', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'admin',
      profile: null
    };

    mockPrisma.user.findUnique.mockResolvedValue(adminUser);
    mockPrisma.user.update.mockResolvedValue({ id: 1, email: 'newadmin@test.com' });
    mockPrisma.profile.create.mockResolvedValue({
      id: 1,
      userId: 1,
      firstName: 'Admin',
      lastName: 'User'
    });

    const response = await request(app)
      .put('/profile/me')
      .set('Authorization', 'Bearer test-token')
      .send({
        email: 'newadmin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        description: 'System Administrator'
      })
      .use(mockAuthenticateToken);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Admin profile updated successfully');
  });

  test('Admin can delete their profile without deleting their account', async () => {
    const adminUser = {
      id: 1,
      email: 'admin@test.com',
      role: 'admin',
      profile: { id: 1, userId: 1 }
    };

    mockPrisma.user.findUnique.mockResolvedValue(adminUser);
    mockPrisma.profile.delete.mockResolvedValue({ id: 1 });

    const response = await request(app)
      .delete('/profile/me')
      .set('Authorization', 'Bearer test-token')
      .use(mockAuthenticateToken);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Admin profile deleted successfully');
  });
});

// Test change password functionality
describe('Change Password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Admin can change password successfully', async () => {
    const hashedPassword = await bcrypt.hash('oldpassword', 10);
    
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@test.com',
      password: hashedPassword
    });

    mockPrisma.user.update.mockResolvedValue({
      id: 1,
      email: 'admin@test.com'
    });

    const response = await request(app)
      .post('/security/change-password')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentPassword: 'oldpassword',
        newPassword: 'newpassword123'
      })
      .use(mockAuthenticateToken);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Password changed successfully.');
  });

  test('Change password fails with incorrect current password', async () => {
    const hashedPassword = await bcrypt.hash('oldpassword', 10);
    
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'admin@test.com',
      password: hashedPassword
    });

    const response = await request(app)
      .post('/security/change-password')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123'
      })
      .use(mockAuthenticateToken);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Current password is incorrect.');
  });

  test('Change password fails with weak new password', async () => {
    const response = await request(app)
      .post('/security/change-password')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentPassword: 'oldpassword',
        newPassword: '123'
      })
      .use(mockAuthenticateToken);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Password must be at least 6 characters long.');
  });

  test('Change password fails when new password is same as current', async () => {
    const response = await request(app)
      .post('/security/change-password')
      .set('Authorization', 'Bearer test-token')
      .send({
        currentPassword: 'samepassword',
        newPassword: 'samepassword'
      })
      .use(mockAuthenticateToken);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('New password must be different from current password.');
  });
}); 