# Employer Request Backend Updates

## Overview

Updated the backend to match the frontend design for employer requests, adding support for phone numbers and candidate-specific requests.

## Changes Made

### 1. Database Schema Updates (`prisma/schema.prisma`)

**Added new fields to `EmployerRequest` model:**

- `phoneNumber String?` - Phone number from request form
- `requestedCandidateId Int?` - Specific candidate requested (job seeker ID)

```prisma
model EmployerRequest {
  id                    Int       @id @default(autoincrement())
  name                  String
  email                 String
  phoneNumber           String?   // NEW: Phone number from request form
  message               String?
  requestedCandidateId  Int?      // NEW: Specific candidate requested
  selectedUserId        Int?
  selectedUser          User?     @relation("SelectedUser", fields: [selectedUserId], references: [id])
  status                String    @default("pending")
  priority              String    @default("normal")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  messages              Message[]
}
```

### 2. Controller Updates (`controllers/employerController.js`)

#### **Enhanced `submitEmployerRequest`:**

- Added support for `phoneNumber` and `requestedCandidateId` fields
- Added validation for requested candidate (ensures it's a valid job seeker)
- Updated email notification to include new fields

```javascript
exports.submitEmployerRequest = async (req, res) => {
  const { name, email, phoneNumber, message, requestedCandidateId } = req.body;

  // Validate requested candidate if provided
  if (requestedCandidateId) {
    const candidate = await prisma.user.findUnique({
      where: { id: parseInt(requestedCandidateId, 10) },
      include: { profile: true },
    });

    if (!candidate || candidate.role !== "jobseeker") {
      return res
        .status(400)
        .json({ error: "Invalid candidate ID or candidate not found." });
    }
  }

  const employerRequest = await prisma.employerRequest.create({
    data: {
      name,
      email,
      phoneNumber,
      message,
      requestedCandidateId: requestedCandidateId
        ? parseInt(requestedCandidateId, 10)
        : null,
    },
  });
};
```

#### **Enhanced `getAllEmployerRequests`:**

- Added requested candidate details to response
- Includes candidate profile information (name, skills, experience, location)

#### **Enhanced `getEmployerRequest`:**

- Added requested candidate details to specific request response
- Includes full candidate profile information

### 3. Email Notification Updates (`utils/mailer.js`)

#### **Enhanced `sendEmployerRequestNotification`:**

- Added support for `phoneNumber` and `requestedCandidateId` parameters
- Fetches and displays candidate details in email
- Shows phone number in admin notification

```javascript
const sendEmployerRequestNotification = async (
  employerName,
  employerEmail,
  message,
  phoneNumber,
  requestedCandidateId
) => {
  // Get candidate details if requested
  let candidateInfo = "";
  if (requestedCandidateId) {
    const candidate = await prisma.user.findUnique({
      where: { id: parseInt(requestedCandidateId, 10) },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            skills: true,
            experience: true,
            location: true,
            city: true,
            country: true,
          },
        },
      },
    });

    if (candidate && candidate.profile) {
      candidateInfo = `
        <h3>Requested Candidate Details:</h3>
        <div>
          <p><strong>Name:</strong> ${candidate.profile.firstName} ${
        candidate.profile.lastName
      }</p>
          <p><strong>Experience:</strong> ${
            candidate.profile.experience || "Not specified"
          }</p>
          <p><strong>Location:</strong> ${location || "Not specified"}</p>
          <p><strong>Skills:</strong> ${
            candidate.profile.skills || "Not specified"
          }</p>
        </div>
      `;
    }
  }
};
```

### 4. Postman Collection Updates (`postman_collection.json`)

#### **Updated "Submit Employer Request (Public)":**

- Added `phoneNumber` and `requestedCandidateId` to request body
- Updated example to match frontend design (Abirebeye Abayo Sincere requesting Francine Mukamana)
- Updated response examples to include new fields
- Updated description to mention new features

#### **Updated "Admin Get All Employer Requests":**

- Updated description to mention new fields
- Updated response example to include `phoneNumber`, `requestedCandidateId`, and `requestedCandidate` object

#### **Updated "Admin Get Specific Employer Request":**

- Updated description to mention new fields
- Updated response example to include candidate details

## Frontend Integration

### Request Flow:

1. **Browse Candidates** → Public job seeker list
2. **View Candidate** → Detailed profile (e.g., Francine Mukamana)
3. **Request Candidate** → Form with:
   - Name (pre-filled)
   - Email (pre-filled)
   - Phone Number (required)
   - Message (requirements)
   - Candidate ID (hidden, auto-filled)
4. **Submit Request** → Backend processes with new fields
5. **Admin Review** → Enhanced notification with candidate details
6. **Connection** → Admin facilitates connection

### Example Request:

```json
{
  "name": "Abirebeye Abayo Sincere",
  "email": "abayosincere11@gmail.co",
  "phoneNumber": "+250788123456",
  "message": "We are looking for a housemaid with experience in childcare and cooking. Please connect us with Francine Mukamana.",
  "requestedCandidateId": 1
}
```

### Example Response:

```json
{
  "message": "Employer request submitted successfully",
  "request": {
    "id": 1,
    "name": "Abirebeye Abayo Sincere",
    "email": "abayosincere11@gmail.co",
    "phoneNumber": "+250788123456",
    "message": "We are looking for a housemaid...",
    "requestedCandidateId": 1,
    "status": "pending",
    "priority": "normal",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Database Migration

Applied changes using:

```bash
npx prisma db push
```

## Benefits

1. **Enhanced User Experience**: Employers can now request specific candidates
2. **Better Admin Notifications**: Admins receive detailed candidate information
3. **Improved Communication**: Phone numbers enable direct contact
4. **Frontend Alignment**: Backend now fully supports frontend design
5. **Data Integrity**: Validates requested candidates are valid job seekers

## Testing

The updated endpoints can be tested using the updated Postman collection with examples that match the frontend design.
