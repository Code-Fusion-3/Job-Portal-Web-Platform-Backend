# Admin Profile Management & Change Password

## Overview

This document describes the admin profile management and change password functionality implemented in the Job Portal Backend API.

## Features Implemented

### 1. Admin Self Profile Management

Admins can now manage their own profiles through the following endpoints:

#### Get Admin Profile

- **Endpoint**: `GET /profile/me`
- **Authentication**: Required (Bearer token)
- **Description**: Retrieves the current admin's profile information
- **Response**: Returns admin user data (with or without profile)

#### Update Admin Profile

- **Endpoint**: `PUT /profile/me`
- **Authentication**: Required (Bearer token)
- **Description**: Updates admin profile information
- **Features**:
  - Can update email address
  - Can create profile if it doesn't exist
  - Can update existing profile
  - Email uniqueness validation
- **Request Body**:
  ```json
  {
    "email": "newadmin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "description": "System Administrator",
    "skills": "Management, Leadership",
    "gender": "Male",
    "dateOfBirth": "1990-01-01",
    "idNumber": "ID123456",
    "contactNumber": "+1234567890",
    "maritalStatus": "Single",
    "location": "Kigali",
    "city": "Kigali",
    "country": "Rwanda",
    "references": "Available upon request",
    "experience": "5 years in management",
    "jobCategoryId": 1
  }
  ```

#### Delete Admin Profile

- **Endpoint**: `DELETE /profile/me`
- **Authentication**: Required (Bearer token)
- **Description**: Deletes admin profile (preserves admin account)
- **Response**: Confirmation message

### 2. Change Password Functionality

Admins can change their passwords securely:

#### Change Password

- **Endpoint**: `POST /security/change-password`
- **Authentication**: Required (Bearer token)
- **Description**: Changes user password with validation
- **Features**:
  - Current password verification
  - Password strength validation
  - Session revocation after password change
  - Prevents using same password
- **Request Body**:
  ```json
  {
    "currentPassword": "oldpassword",
    "newPassword": "newpassword123"
  }
  ```

## Implementation Details

### Profile Management Logic

1. **Role-based Handling**: The system distinguishes between admins and job seekers
2. **Profile Creation**: Admins can create profiles if they don't exist
3. **Email Updates**: Admins can change their email with uniqueness validation
4. **Safe Deletion**: Admin profile deletion preserves the admin account

### Password Change Security

1. **Current Password Verification**: Uses bcrypt to verify current password
2. **Password Strength**: Minimum 6 characters required
3. **Duplicate Prevention**: New password must be different from current
4. **Session Management**: Revokes all refresh tokens after password change
5. **Error Handling**: Comprehensive error messages for different scenarios

## API Response Examples

### Successful Profile Update

```json
{
  "message": "Admin profile updated successfully",
  "profile": {
    "id": 1,
    "userId": 1,
    "firstName": "Admin",
    "lastName": "User",
    "description": "System Administrator",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Successful Password Change

```json
{
  "message": "Password changed successfully."
}
```

### Error Responses

#### Invalid Current Password

```json
{
  "error": "Current password is incorrect."
}
```

#### Weak Password

```json
{
  "error": "Password must be at least 6 characters long."
}
```

#### Same Password

```json
{
  "error": "New password must be different from current password."
}
```

## Security Considerations

1. **Password Hashing**: All passwords are hashed using bcrypt
2. **Session Revocation**: All sessions are revoked after password change
3. **Input Validation**: Comprehensive validation for all inputs
4. **Role-based Access**: Proper role checking for admin operations
5. **Error Handling**: Secure error messages that don't leak sensitive information

## Testing

The functionality includes comprehensive tests covering:

- Admin profile retrieval (with and without profile)
- Admin profile creation and updates
- Admin profile deletion
- Password change with various scenarios
- Error handling for invalid inputs

## Usage Examples

### Frontend Integration

```javascript
// Get admin profile
const getAdminProfile = async () => {
  const response = await fetch("/profile/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.json();
};

// Update admin profile
const updateAdminProfile = async (profileData) => {
  const response = await fetch("/profile/me", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profileData),
  });
  return response.json();
};

// Change password
const changePassword = async (currentPassword, newPassword) => {
  const response = await fetch("/security/change-password", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentPassword,
      newPassword,
    }),
  });
  return response.json();
};
```

## Migration Notes

- Existing admin users without profiles can now create them
- Password change functionality works for both admins and job seekers
- No database migrations required
- Backward compatible with existing functionality
