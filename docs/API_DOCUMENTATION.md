# Job Portal Backend API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Error Handling](#error-handling)
5. [Endpoints](#endpoints)
   - [Authentication](#authentication-endpoints)
   - [Profile Management](#profile-management)
   - [Employer Requests](#employer-requests)
   - [Job Categories](#job-categories)
   - [Public Endpoints](#public-endpoints)
   - [Dashboard](#dashboard)
   - [Messaging](#messaging)
   - [Search](#search)
   - [Settings](#settings)
   - [Security](#security)

## Overview

The Job Portal Backend API is a RESTful service built with Node.js, Express.js, PostgreSQL, and Prisma ORM. It provides endpoints for job seeker registration, employer requests, messaging, and administrative functions.

### Features

- User authentication with JWT tokens
- Profile management for job seekers
- Employer request handling
- Real-time messaging with Redis
- Advanced search and filtering
- Admin dashboard and analytics
- File upload support
- Email notifications

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Types

- **Access Token**: Short-lived (1 hour) for API access
- **Refresh Token**: Long-lived (7 days) for token renewal

## Base URL

```
http://localhost:3000
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

Common HTTP Status Codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Endpoints

### Authentication Endpoints

#### Register Job Seeker

```http
POST /register
Content-Type: multipart/form-data
```

**Request Body:**

- `email` (string, required) - User email
- `password` (string, required) - User password (min 6 chars)
- `firstName` (string, required) - First name
- `lastName` (string, required) - Last name
- `description` (string) - User description
- `skills` (string) - Skills (comma-separated)
- `gender` (string) - Gender (Male/Female/Other)
- `dateOfBirth` (date) - Date of birth (18+ years)
- `idNumber` (string) - ID number (16 digits)
- `contactNumber` (string) - Contact number
- `maritalStatus` (string) - Marital status
- `location` (string) - Location
- `city` (string) - City
- `country` (string) - Country
- `references` (string) - References
- `experience` (string) - Experience
- `jobCategoryId` (integer) - Job category ID
- `photo` (file) - Profile photo (optional)

**Response:**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "jobseeker",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "skills": "JavaScript, React",
      "experience": "5 years"
    }
  },
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

#### Login

```http
POST /login
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "jobseeker"
  },
  "token": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

### Profile Management

#### Get My Profile

```http
GET /profile/me
Authorization: Bearer <token>
```

**Response:**

```json
{
  "profile": {
    "id": 1,
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "skills": "JavaScript, React",
    "experience": "5 years",
    "location": "Kigali, Rwanda"
  }
}
```

#### Update My Profile

```http
PUT /profile/me
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "firstName": "John Updated",
  "lastName": "Doe Updated",
  "description": "Updated description",
  "skills": "JavaScript, React, Node.js"
}
```

#### Admin: Get All Job Seekers

```http
GET /profile/all?page=1&limit=10
Authorization: Bearer <admin-token>
```

**Query Parameters:**

- `page` (integer) - Page number (default: 1)
- `limit` (integer) - Items per page (default: 10)

**Response:**

```json
{
  "users": [
    {
      "id": 1,
      "email": "user@example.com",
      "role": "jobseeker",
      "profile": {
        "firstName": "John",
        "lastName": "Doe",
        "skills": "JavaScript, React"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

#### Admin: Create Job Seeker

```http
POST /profile/
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "firstName": "New",
  "lastName": "User",
  "description": "New user description",
  "skills": "Python, Django",
  "gender": "Male",
  "dateOfBirth": "1990-01-01",
  "idNumber": "1234567890123456",
  "contactNumber": "+250788123456",
  "maritalStatus": "Single",
  "location": "Kigali, Rwanda",
  "city": "Kigali",
  "country": "Rwanda",
  "references": "Available upon request",
  "experience": "3 years",
  "jobCategoryId": 1
}
```

### Employer Requests

#### Submit Employer Request (Public)

```http
POST /employer/request
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Employer Name",
  "email": "employer@company.com",
  "message": "Looking for skilled developers"
}
```

#### Admin: Get All Employer Requests

```http
GET /employer/requests?page=1&limit=10
Authorization: Bearer <admin-token>
```

#### Admin: Get Specific Employer Request

```http
GET /employer/requests/:id
Authorization: Bearer <admin-token>
```

#### Admin: Reply to Employer Request

```http
POST /employer/requests/:id/reply
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "Thank you for your request. We have several qualified candidates."
}
```

### Job Categories

#### Get All Categories (Public)

```http
GET /categories/
```

#### Admin: Create Job Category

```http
POST /categories/
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name_en": "Software Development",
  "name_rw": "Ubwubatsi bwa Software"
}
```

#### Admin: Update Job Category

```http
PUT /categories/:id
Authorization: Bearer <admin-token>
Content-Type: application/json
```

#### Admin: Delete Job Category

```http
DELETE /categories/:id
Authorization: Bearer <admin-token>
```

### Public Endpoints

#### Get Public Job Seekers

```http
GET /public/job-seekers?page=1&limit=10&categoryId=1&skills=JavaScript
```

**Query Parameters:**

- `page` (integer) - Page number
- `limit` (integer) - Items per page
- `categoryId` (integer) - Filter by category
- `skills` (string) - Filter by skills
- `experience` (string) - Filter by experience
- `location` (string) - Filter by location

#### Get Public Statistics

```http
GET /public/statistics
```

**Response:**

```json
{
  "totalJobSeekers": 150,
  "totalCategories": 8,
  "topCategories": [
    {
      "name": "Software Development",
      "count": 45
    }
  ],
  "topLocations": [
    {
      "city": "Kigali",
      "count": 80
    }
  ],
  "recentRegistrations": 12
}
```

#### Get Available Filters

```http
GET /public/filters
```

### Dashboard

#### Get Dashboard Statistics

```http
GET /dashboard/stats
Authorization: Bearer <admin-token>
```

#### Get Analytics

```http
GET /dashboard/analytics?period=30
Authorization: Bearer <admin-token>
```

**Query Parameters:**

- `period` (integer) - Days for analytics (default: 30)

### Messaging

#### Admin: Send Message to Employer

```http
POST /messaging/admin/:id/send
Authorization: Bearer <admin-token>
Content-Type: multipart/form-data
```

**Request Body:**

- `message` (string, required) - Message content
- `attachment` (file, optional) - File attachment

#### Employer: Reply to Admin

```http
POST /messaging/employer/:id/reply
Content-Type: multipart/form-data
```

**Request Body:**

- `employerEmail` (string, required) - Employer email
- `message` (string, required) - Message content
- `attachment` (file, optional) - File attachment

#### Get Conversation

```http
GET /messaging/conversation/:id?email=employer@example.com
```

**Query Parameters:**

- `email` (string) - Employer email (for employer access)

#### Mark Messages as Read

```http
POST /messaging/conversation/:id/read
Authorization: Bearer <token>
```

#### Get Unread Count

```http
GET /messaging/conversation/:id/unread
Authorization: Bearer <token>
```

### Search

#### Advanced Job Seeker Search

```http
GET /search/job-seekers?query=JavaScript&categoryId=1&skills=React&location=Kigali
```

**Query Parameters:**

- `query` (string) - Search query
- `categoryId` (integer) - Filter by category
- `skills` (string) - Filter by skills
- `experience` (string) - Filter by experience
- `location` (string) - Filter by location
- `city` (string) - Filter by city
- `country` (string) - Filter by country
- `gender` (string) - Filter by gender
- `ageRange` (string) - Filter by age range (e.g., "25-35")
- `dateRange` (string) - Filter by registration date (e.g., "2024-01-01|2024-12-31")
- `page` (integer) - Page number
- `limit` (integer) - Items per page
- `sortBy` (string) - Sort field
- `sortOrder` (string) - Sort order (asc/desc)

#### Get Search Suggestions

```http
GET /search/suggestions?query=Java&type=jobseekers
```

**Query Parameters:**

- `query` (string) - Search query (min 2 chars)
- `type` (string) - Type of suggestions (jobseekers/conversations)

#### Get Search Filters

```http
GET /search/filters
```

#### Admin: Search Conversations

```http
GET /search/conversations?query=urgent&requestId=1&fromAdmin=true
Authorization: Bearer <admin-token>
```

### Settings

#### Get System Settings

```http
GET /settings/system
Authorization: Bearer <admin-token>
```

#### Update System Settings

```http
PUT /settings/system
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "system": {
    "maintenance": false,
    "registrationEnabled": true,
    "maxFileSize": 10485760
  },
  "security": {
    "sessionTimeout": 86400,
    "maxLoginAttempts": 5,
    "passwordMinLength": 6
  }
}
```

#### Get Email Templates

```http
GET /settings/email-templates
Authorization: Bearer <admin-token>
```

#### Update Email Template

```http
PUT /settings/email-templates
Authorization: Bearer <admin-token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "templateName": "welcomeEmail",
  "subject": "Welcome to Job Portal!",
  "content": "HTML email content"
}
```

#### Get System Logs

```http
GET /settings/logs?type=all&page=1&limit=50
Authorization: Bearer <admin-token>
```

#### Backup System Data

```http
POST /settings/backup
Authorization: Bearer <admin-token>
```

### Security

#### Refresh Access Token

```http
POST /security/refresh-token
Content-Type: application/json
```

**Request Body:**

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

#### Request Password Reset

```http
POST /security/request-password-reset
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

#### Reset Password

```http
POST /security/reset-password
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "reset-token",
  "newPassword": "newpassword123"
}
```

#### Change Password

```http
POST /security/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

#### Logout

```http
POST /security/logout
Authorization: Bearer <token>
```

#### Admin: Get User Sessions

```http
GET /security/user-sessions/:userId
Authorization: Bearer <admin-token>
```

#### Admin: Revoke User Session

```http
DELETE /security/user-sessions/:userId/:sessionId
Authorization: Bearer <admin-token>
```

#### Admin: Get Security Logs

```http
GET /security/logs?page=1&limit=50
Authorization: Bearer <admin-token>
```

---

## Data Models

### User

```json
{
  "id": 1,
  "email": "user@example.com",
  "role": "jobseeker",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Profile

```json
{
  "id": 1,
  "userId": 1,
  "firstName": "John",
  "lastName": "Doe",
  "description": "Experienced developer",
  "skills": "JavaScript, React, Node.js",
  "gender": "Male",
  "dateOfBirth": "1990-01-01T00:00:00.000Z",
  "idNumber": "1234567890123456",
  "contactNumber": "+250788123456",
  "maritalStatus": "Single",
  "location": "Kigali, Rwanda",
  "city": "Kigali",
  "country": "Rwanda",
  "references": "Available upon request",
  "experience": "5 years",
  "photo": "uploads/profiles/profile-123.jpg",
  "jobCategoryId": 1,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### EmployerRequest

```json
{
  "id": 1,
  "name": "Employer Name",
  "email": "employer@company.com",
  "message": "Looking for skilled developers",
  "selectedUserId": 1,
  "status": "pending",
  "priority": "normal",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Message

```json
{
  "id": 1,
  "employerRequestId": 1,
  "fromAdmin": true,
  "employerEmail": "employer@company.com",
  "content": "Message content",
  "messageType": "text",
  "attachmentUrl": "uploads/messages/file.pdf",
  "attachmentName": "document.pdf",
  "isRead": false,
  "readAt": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### JobCategory

```json
{
  "id": 1,
  "name_en": "Software Development",
  "name_rw": "Ubwubatsi bwa Software",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/job_portal"

# JWT
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"

# Email
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-app-password"
ADMIN_EMAIL="admin@jobportal.com"

# Redis
REDIS_URL="redis://localhost:6379"

# Frontend
FRONTEND_URL="http://localhost:3000"

# Server
PORT=3000
NODE_ENV=development
```

---

## Rate Limiting

The API implements rate limiting for security endpoints:

- Password reset requests: 3 attempts per hour per email
- Login attempts: 5 attempts per 15 minutes per IP
- General API requests: 100 requests per minute per IP

---

## File Upload

### Supported File Types

- **Profile Photos**: JPEG, PNG, GIF (max 5MB)
- **Message Attachments**: PDF, DOC, DOCX, XLS, XLSX, TXT, JPEG, PNG, GIF (max 10MB)

### File Storage

Files are stored in the `uploads/` directory:

- Profile photos: `uploads/profiles/`
- Message attachments: `uploads/messages/`

---

## WebSocket Events (Real-time Features)

### Connection

```javascript
// Connect to WebSocket
const socket = io("http://localhost:3000");

// Authenticate
socket.emit("authenticate", { token: "jwt-token" });
```

### Events

- `message_received` - New message received
- `user_online` - User came online
- `user_offline` - User went offline
- `notification` - System notification

---

## Testing

Run tests using the following commands:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:auth
npm run test:profile

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

---

## Deployment

### Prerequisites

- Node.js 16+
- PostgreSQL 12+
- Redis 6+
- PM2 (for production)

### Production Setup

```bash
# Install dependencies
npm install --production

# Set environment variables
cp .env.example .env

# Run database migrations
npx prisma migrate deploy

# Seed database
npm run seed

# Start production server
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t job-portal-backend .

# Run container
docker run -p 3000:3000 --env-file .env job-portal-backend
```

---

## Support

For API support and questions:

- Email: support@jobportal.com
- Documentation: https://docs.jobportal.com
- GitHub Issues: https://github.com/jobportal/backend/issues
