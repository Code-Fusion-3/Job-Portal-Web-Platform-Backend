const request = require('supertest');
const app = require('../index');
const { PrismaClient } = require('../generated/prisma');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

describe('Authentication Endpoints', () => {
  let testUser;

  beforeAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ['test@example.com', 'test2@example.com']
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /register', () => {
    it('should register a new job seeker successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        description: 'Experienced developer',
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
        jobCategoryId: 1
      };

      const response = await request(app)
        .post('/register')
        .field('email', userData.email)
        .field('password', userData.password)
        .field('firstName', userData.firstName)
        .field('lastName', userData.lastName)
        .field('description', userData.description)
        .field('skills', userData.skills)
        .field('gender', userData.gender)
        .field('dateOfBirth', userData.dateOfBirth)
        .field('idNumber', userData.idNumber)
        .field('contactNumber', userData.contactNumber)
        .field('maritalStatus', userData.maritalStatus)
        .field('location', userData.location)
        .field('city', userData.city)
        .field('country', userData.country)
        .field('references', userData.references)
        .field('experience', userData.experience)
        .field('jobCategoryId', userData.jobCategoryId)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.role).toBe('jobseeker');
      expect(response.body.user.profile.firstName).toBe(userData.firstName);
      expect(response.body.user.profile.lastName).toBe(userData.lastName);

      testUser = response.body.user;
    });

    it('should return 409 for duplicate email', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        description: 'Another developer',
        skills: 'Python, Django',
        gender: 'Female',
        dateOfBirth: '1992-01-01',
        idNumber: '1234567890123457',
        contactNumber: '+250788123457',
        maritalStatus: 'Single',
        location: 'Kigali, Rwanda',
        city: 'Kigali',
        country: 'Rwanda',
        references: 'Available upon request',
        experience: '3 years',
        jobCategoryId: 1
      };

      const response = await request(app)
        .post('/register')
        .field('email', userData.email)
        .field('password', userData.password)
        .field('firstName', userData.firstName)
        .field('lastName', userData.lastName)
        .field('description', userData.description)
        .field('skills', userData.skills)
        .field('gender', userData.gender)
        .field('dateOfBirth', userData.dateOfBirth)
        .field('idNumber', userData.idNumber)
        .field('contactNumber', userData.contactNumber)
        .field('maritalStatus', userData.maritalStatus)
        .field('location', userData.location)
        .field('city', userData.city)
        .field('country', userData.country)
        .field('references', userData.references)
        .field('experience', userData.experience)
        .field('jobCategoryId', userData.jobCategoryId)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email already registered.');
    });

    it('should return 400 for invalid data', async () => {
      const userData = {
        email: 'invalid-email',
        password: '123', // Too short
        firstName: '', // Empty
        lastName: 'Doe',
        dateOfBirth: '2010-01-01', // Under 18
        idNumber: '123', // Invalid format
        contactNumber: 'invalid-phone',
        jobCategoryId: 999 // Non-existent category
      };

      const response = await request(app)
        .post('/register')
        .field('email', userData.email)
        .field('password', userData.password)
        .field('firstName', userData.firstName)
        .field('lastName', userData.lastName)
        .field('dateOfBirth', userData.dateOfBirth)
        .field('idNumber', userData.idNumber)
        .field('contactNumber', userData.contactNumber)
        .field('jobCategoryId', userData.jobCategoryId)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });
  });

  describe('POST /login', () => {
    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body.user.role).toBe('jobseeker');
    });

    it('should return 401 for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid credentials.');
    });

    it('should return 404 for non-existent user', async () => {
      const loginData = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/login')
        .send(loginData)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('User not found.');
    });
  });

  describe('POST /security/request-password-reset', () => {
    it('should send password reset email for existing user', async () => {
      const resetData = {
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/security/request-password-reset')
        .send(resetData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('If the email exists, a password reset link has been sent.');
    });

    it('should not reveal if email exists or not', async () => {
      const resetData = {
        email: 'nonexistent@example.com'
      };

      const response = await request(app)
        .post('/security/request-password-reset')
        .send(resetData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('If the email exists, a password reset link has been sent.');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/security/request-password-reset')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Email is required.');
    });
  });

  describe('POST /security/refresh-token', () => {
    it('should refresh access token with valid refresh token', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await request(app)
        .post('/security/refresh-token')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/security/refresh-token')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Invalid refresh token.');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/security/refresh-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Refresh token is required.');
    });
  });
});