const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('../generated/prisma');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Profile Management Endpoints', () => {
  let authToken;
  let adminToken;
  let testUserId;

  beforeAll(async () => {
    // Create test user and get auth token
    const loginResponse = await request(app)
      .post('/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
    testUserId = loginResponse.body.user.id;

    // Create admin token
    const adminLoginResponse = await request(app)
      .post('/login')
      .send({
        email: 'admin@jobportal.com',
        password: 'admin123'
      });

    adminToken = adminLoginResponse.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('GET /profile/me', () => {
    it('should get current user profile', async () => {
      const response = await request(app)
        .get('/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile.firstName).toBe('John');
      expect(response.body.profile.lastName).toBe('Doe');
      expect(response.body.profile.email).toBe('test@example.com');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/profile/me')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /profile/me', () => {
    it('should update current user profile', async () => {
      const updateData = {
        firstName: 'John Updated',
        lastName: 'Doe Updated',
        description: 'Updated description',
        skills: 'JavaScript, React, Node.js, TypeScript',
        experience: '6 years'
      };

      const response = await request(app)
        .put('/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile.firstName).toBe(updateData.firstName);
      expect(response.body.profile.lastName).toBe(updateData.lastName);
      expect(response.body.profile.description).toBe(updateData.description);
    });

    it('should return 400 for invalid data', async () => {
      const invalidData = {
        firstName: '', // Empty
        dateOfBirth: '2010-01-01', // Under 18
        idNumber: '123' // Invalid format
      };

      const response = await request(app)
        .put('/profile/me')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('GET /profile/all (Admin)', () => {
    it('should get all job seekers with pagination', async () => {
      const response = await request(app)
        .get('/profile/all?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('total');
    });

    it('should return 403 for non-admin users', async () => {
      const response = await request(app)
        .get('/profile/all')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Admin access required.');
    });
  });

  describe('GET /profile/:id (Admin)', () => {
    it('should get specific user profile by admin', async () => {
      const response = await request(app)
        .get(`/profile/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile.id).toBe(testUserId);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .get('/profile/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('User not found.');
    });
  });

  describe('POST /profile/ (Admin Create)', () => {
    it('should create job seeker account by admin', async () => {
      const userData = {
        email: 'admin-created@example.com',
        firstName: 'Admin',
        lastName: 'Created',
        description: 'Created by admin',
        skills: 'Python, Django',
        gender: 'Male',
        dateOfBirth: '1990-01-01',
        idNumber: '1234567890123458',
        contactNumber: '+250788123458',
        maritalStatus: 'Single',
        location: 'Kigali, Rwanda',
        city: 'Kigali',
        country: 'Rwanda',
        references: 'Available upon request',
        experience: '4 years',
        jobCategoryId: 1
      };

      const response = await request(app)
        .post('/profile/')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('jobseeker');
      expect(response.body.user.profile.firstName).toBe(userData.firstName);
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        email: 'test@example.com', // Already exists
        firstName: 'Duplicate',
        lastName: 'User',
        description: 'Duplicate user',
        skills: 'JavaScript',
        gender: 'Male',
        dateOfBirth: '1990-01-01',
        idNumber: '1234567890123459',
        contactNumber: '+250788123459',
        maritalStatus: 'Single',
        location: 'Kigali, Rwanda',
        city: 'Kigali',
        country: 'Rwanda',
        references: 'Available upon request',
        experience: '3 years',
        jobCategoryId: 1
      };

      const response = await request(app)
        .post('/profile/')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email already registered.');
    });
  });

  describe('PUT /profile/:id (Admin Update)', () => {
    it('should update job seeker profile by admin', async () => {
      const updateData = {
        firstName: 'Admin Updated',
        lastName: 'User',
        description: 'Updated by admin',
        skills: 'JavaScript, React, Vue.js',
        experience: '7 years'
      };

      const response = await request(app)
        .put(`/profile/${testUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile.firstName).toBe(updateData.firstName);
      expect(response.body.profile.description).toBe(updateData.description);
    });

    it('should return 404 for non-existent user', async () => {
      const updateData = {
        firstName: 'Non-existent',
        lastName: 'User'
      };

      const response = await request(app)
        .put('/profile/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Job seeker not found.');
    });
  });

  describe('DELETE /profile/:id (Admin Delete)', () => {
    it('should delete job seeker account by admin', async () => {
      // First create a user to delete
      const createResponse = await request(app)
        .post('/profile/')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'to-delete@example.com',
          firstName: 'To Delete',
          lastName: 'User',
          description: 'Will be deleted',
          skills: 'JavaScript',
          gender: 'Male',
          dateOfBirth: '1990-01-01',
          idNumber: '1234567890123460',
          contactNumber: '+250788123460',
          maritalStatus: 'Single',
          location: 'Kigali, Rwanda',
          city: 'Kigali',
          country: 'Rwanda',
          references: 'Available upon request',
          experience: '2 years',
          jobCategoryId: 1
        });

      const userIdToDelete = createResponse.body.user.id;

      const response = await request(app)
        .delete(`/profile/${userIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Worker deleted successfully.');

      // Verify user is deleted
      const checkResponse = await request(app)
        .get(`/profile/${userIdToDelete}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/profile/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Worker not found.');
    });
  });

  describe('DELETE /profile/me', () => {
    it('should delete current user account', async () => {
      // Create a new user for this test
      const createResponse = await request(app)
        .post('/profile/')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'self-delete@example.com',
          firstName: 'Self Delete',
          lastName: 'User',
          description: 'Will delete self',
          skills: 'JavaScript',
          gender: 'Male',
          dateOfBirth: '1990-01-01',
          idNumber: '1234567890123461',
          contactNumber: '+250788123461',
          maritalStatus: 'Single',
          location: 'Kigali, Rwanda',
          city: 'Kigali',
          country: 'Rwanda',
          references: 'Available upon request',
          experience: '2 years',
          jobCategoryId: 1
        });

      const newUserToken = createResponse.body.token;

      const response = await request(app)
        .delete('/profile/me')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Account deleted successfully.');

      // Verify user is deleted
      const checkResponse = await request(app)
        .get('/profile/me')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(401);
    });
  });
}); 