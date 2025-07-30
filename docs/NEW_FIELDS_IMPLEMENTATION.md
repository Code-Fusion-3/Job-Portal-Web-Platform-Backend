# New Fields Implementation: Company Name & Monthly Rate

## Overview

Successfully implemented two new optional fields:

- **Company Name** (`companyName`) for employer requests
- **Monthly Rate** (`monthlyRate`) for job seeker profiles

## Database Schema Changes

### 1. EmployerRequest Model

```prisma
model EmployerRequest {
  id                    Int       @id @default(autoincrement())
  name                  String
  email                 String
  phoneNumber           String?   // Phone number from request form
  companyName           String?   // NEW: Company name (optional)
  message               String?
  requestedCandidateId  Int?      // Specific candidate requested
  selectedUserId        Int?
  selectedUser          User?     @relation("SelectedUser", fields: [selectedUserId], references: [id])
  status                String    @default("pending")
  priority              String    @default("normal")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  messages              Message[]
}
```

### 2. Profile Model

```prisma
model Profile {
  id            Int          @id @default(autoincrement())
  userId        Int          @unique
  firstName     String
  lastName      String
  description   String?
  skills        String?
  photo         String?
  gender        String?
  dateOfBirth   DateTime?
  idNumber      String?
  contactNumber String?
  maritalStatus String?
  location      String?
  city          String?
  country       String?
  references    String?
  experience    String?
  monthlyRate   String?      // NEW: Monthly rate/salary expectation
  jobCategoryId Int?
  jobCategory   JobCategory? @relation(fields: [jobCategoryId], references: [id])
  user          User         @relation(fields: [userId], references: [id])
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}
```

## Controller Updates

### 1. Employer Controller (`controllers/employerController.js`)

**Enhanced `submitEmployerRequest`:**

```javascript
exports.submitEmployerRequest = async (req, res) => {
  const {
    name,
    email,
    phoneNumber,
    companyName,
    message,
    requestedCandidateId,
  } = req.body;

  const employerRequest = await prisma.employerRequest.create({
    data: {
      name,
      email,
      phoneNumber,
      companyName, // NEW: Optional company name
      message,
      requestedCandidateId: requestedCandidateId
        ? parseInt(requestedCandidateId, 10)
        : null,
    },
  });
};
```

### 2. Auth Controller (`controllers/authController.js`)

**Enhanced `registerJobSeeker`:**

```javascript
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
    monthlyRate,
    jobCategoryId,
  } = req.body;

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "jobseeker",
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
          monthlyRate, // NEW: Monthly rate
          jobCategoryId: categoryId,
        },
      },
    },
  });
};
```

### 3. Profile Controller (`controllers/profileController.js`)

**Enhanced profile management:**

- ✅ `updateMyProfile` - Supports monthly rate for both admins and job seekers
- ✅ `adminCreateJobSeeker` - Includes monthly rate in admin-created profiles
- ✅ All profile update operations now handle monthly rate

## Email Notification Updates

### Enhanced `sendEmployerRequestNotification` (`utils/mailer.js`)

```javascript
const sendEmployerRequestNotification = async (
  employerName,
  employerEmail,
  message,
  phoneNumber,
  companyName,
  requestedCandidateId
) => {
  const phoneInfo = phoneNumber
    ? `<p><strong>Phone Number:</strong> ${phoneNumber}</p>`
    : "";
  const companyInfo = companyName
    ? `<p><strong>Company Name:</strong> ${companyName}</p>`
    : "";

  // Email template now includes company name
  const mailOptions = {
    html: `
      <div>
        <h2>New Employer Request</h2>
        <p><strong>Employer Name:</strong> ${employerName}</p>
        <p><strong>Employer Email:</strong> ${employerEmail}</p>
        ${phoneInfo}
        ${companyInfo}  // NEW: Company name in email
        <p><strong>Message:</strong></p>
        <div>${message || "No message provided"}</div>
        ${candidateInfo}
      </div>
    `,
  };
};
```

## API Examples

### 1. Employer Request with Company Name

```json
{
  "name": "Abirebeye Abayo Sincere",
  "email": "abayosincere11@gmail.co",
  "phoneNumber": "+250788123456",
  "companyName": "Abayo Enterprises Ltd",
  "message": "We are looking for a housemaid with experience in childcare and cooking. Please connect us with Francine Mukamana.",
  "requestedCandidateId": 1
}
```

### 2. Job Seeker Registration with Monthly Rate

```json
{
  "email": "sarah.johnson@example.com",
  "password": "securepassword123",
  "firstName": "Sarah",
  "lastName": "Johnson",
  "description": "Experienced full-stack developer with 7 years of experience.",
  "skills": "JavaScript, React, Node.js, Python, Django, PostgreSQL, AWS, Docker, Git",
  "gender": "Female",
  "dateOfBirth": "1992-08-15",
  "idNumber": "1234567890123456",
  "contactNumber": "+250788987654",
  "maritalStatus": "Married",
  "location": "Kigali, Rwanda",
  "city": "Kigali",
  "country": "Rwanda",
  "references": "Available upon request. Previous employers: TechCorp Rwanda, Digital Solutions Ltd.",
  "experience": "7 years in software development",
  "monthlyRate": "500,000 RWF",
  "jobCategoryId": 1
}
```

### 3. Admin Create Job Seeker with Monthly Rate

```json
{
  "email": "worker1@example.com",
  "firstName": "Worker",
  "lastName": "One",
  "skills": "Plumbing, Carpentry",
  "gender": "Male",
  "dateOfBirth": "1990-01-01",
  "idNumber": "1234567890123456",
  "contactNumber": "+250788000001",
  "maritalStatus": "Single",
  "location": "Kigali, Rwanda",
  "city": "Kigali",
  "country": "Rwanda",
  "references": "Available upon request",
  "experience": "3 years",
  "monthlyRate": "250,000 RWF",
  "jobCategoryId": 1
}
```

## Postman Collection Updates

### Updated Endpoints:

1. **Submit Employer Request (Public)** - Added `companyName` field
2. **User Registration (Job Seeker)** - Added `monthlyRate` field
3. **Admin Create Job Seeker** - Added `monthlyRate` field
4. **Admin Get All Employer Requests** - Updated descriptions
5. **Admin Get Specific Employer Request** - Updated descriptions

### Updated Descriptions:

- "Supports phone number, company name, and requested candidate ID"
- "Includes selected job seekers, latest messages, phone numbers, company names, and requested candidate details"
- "Includes phone number, company name, and requested candidate information"

## Database Migration

Applied successfully using:

```bash
npx prisma db push
```

## Benefits

### Company Name Benefits:

1. **Professional Context**: Employers can provide company information
2. **Better Admin Notifications**: Admins see company details in emails
3. **Enhanced Communication**: More professional employer requests
4. **Optional Field**: Doesn't break existing functionality

### Monthly Rate Benefits:

1. **Salary Expectations**: Job seekers can specify their rate
2. **Better Matching**: Employers can see salary expectations
3. **Professional Profiles**: More complete job seeker information
4. **Optional Field**: Flexible for different job types

## Frontend Integration

### Employer Request Form:

```javascript
// Frontend can now collect:
-name(required) -
  email(required) -
  phoneNumber(optional) -
  companyName(optional) - // NEW
  message(optional) -
  requestedCandidateId(optional);
```

### Job Seeker Registration Form:

```javascript
// Frontend can now collect:
- All existing fields
- monthlyRate (optional)  // NEW
```

## Testing

All endpoints have been updated in the Postman collection with realistic examples:

- Employer requests include company names
- Job seeker registrations include monthly rates
- Admin notifications include company information
- All existing functionality preserved

## Status: ✅ COMPLETE

- ✅ Database schema updated
- ✅ All controllers enhanced
- ✅ Email notifications updated
- ✅ Postman collection updated
- ✅ Backward compatibility maintained
- ✅ Optional fields (no breaking changes)
