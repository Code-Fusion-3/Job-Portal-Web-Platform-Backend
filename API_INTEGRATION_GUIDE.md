# Job Portal Backend - API Integration Guide

## 🚀 Overview

Complete API documentation for Job Portal Backend including authentication, payment workflows, and analytics.

## 🔐 Authentication

**Base URL**: `http://localhost:3000`
**Header**: `Authorization: Bearer <JWT_TOKEN>`

### Login Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "employer|admin|jobseeker"
  }
}
```

## 👥 User Management

### Employer Registration

```http
POST /employer/auth/register
```

**Body**: `{ "name", "email", "phoneNumber", "companyName", "password" }`

### Employer Login

```http
POST /employer/auth/login
```

**Body**: `{ "email", "password" }`

### Get Profile

```http
GET /employer/auth/profile
```

## 📋 Employer Request Management

### Submit Request

```http
POST /employer-requests
```

**Body**: `{ "name", "email", "phoneNumber", "companyName", "message", "requestedCandidateId", "priority" }`

### Get Request History

```http
GET /request-history/employer/history?page=1&limit=10&status=pending
```

**Query Params**: `page`, `limit`, `status`, `priority`, `search`, `sortBy`, `sortOrder`

**Response**:

```json
{
  "requests": [
    {
      "id": 1,
      "status": "pending",
      "requestedCandidate": {
        "profile": {
          "firstName": "J***",
          "lastName": "D**",
          "skills": "JavaScript, React, Node.js",
          "photo": null,
          "contactNumber": "078*****56"
        },
        "accessLevel": "none",
        "accessGranted": { "photo": false, "contact": false }
      }
    }
  ],
  "pagination": { "page": 1, "total": 25, "totalPages": 3 },
  "summary": { "totalRequests": 25, "statusCounts": { "pending": 10 } }
}
```

## 💰 Payment System

### Get Payment Methods

```http
GET /payment-methods/active
```

### Confirm Payment

```http
POST /payment-confirmations/confirm
```

**Body**: `{ "paymentId", "confirmationName", "confirmationPhone", "paymentReference", "transferAmount", "transferDate", "notes" }`

### Get Payment Details

```http
GET /payments/details/:employerRequestId
```

### Get Request Progress

```http
GET /payments/progress/:employerRequestId
```

## 📊 Admin Management

### Get All Requests

```http
GET /employer-requests/admin?page=1&limit=10&status=pending
```

### Request Payment

```http
POST /payments/request
```

**Body**: `{ "employerRequestId", "amount", "currency", "description", "paymentMethodId", "paymentType", "dueDate" }`

### Review Payment

```http
POST /payment-confirmations/review/:paymentId
```

**Body**: `{ "action": "approve|reject", "notes" }`

## 📈 Analytics & Reporting

### Dashboard Analytics

```http
GET /dashboard/analytics?period=30
```

### Request Reports

```http
GET /request-history/admin/reports?period=30&status=approved
```

### Employer Analytics

```http
GET /request-history/admin/employer/:id/analytics?period=30
```

### Activity Feed

```http
GET /dashboard/activity-feed?limit=20
```

## 🔧 Payment Method Management (Admin)

### Create Method

```http
POST /payment-methods
```

**Body**: `{ "name", "type", "accountName", "accountNumber", "bankName", "isActive", "sortOrder" }`

### Get All Methods

```http
GET /payment-methods/admin/all
```

### Update Method

```http
PUT /payment-methods/:id
```

### Delete Method

```http
DELETE /payment-methods/:id
```

### Toggle Status

```http
PATCH /payment-methods/:id/toggle
```

### Reorder Methods

```http
POST /payment-methods/reorder
```

## 📱 Frontend Integration Examples

### Payment Confirmation Component

```jsx
import React, { useState } from "react";
import axios from "axios";

const PaymentConfirmation = ({ paymentId, onSuccess }) => {
  const [formData, setFormData] = useState({
    confirmationName: "",
    confirmationPhone: "",
    paymentReference: "",
    transferAmount: "",
    transferDate: "",
    notes: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("/payment-confirmations/confirm", {
        paymentId,
        ...formData,
      });

      onSuccess(response.data);
    } catch (error) {
      console.error("Payment confirmation failed:", error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Your Name *"
        value={formData.confirmationName}
        onChange={(e) =>
          setFormData({ ...formData, confirmationName: e.target.value })
        }
        required
      />

      <input
        type="tel"
        placeholder="Phone Number *"
        value={formData.confirmationPhone}
        onChange={(e) =>
          setFormData({ ...formData, confirmationPhone: e.target.value })
        }
        required
      />

      <input
        type="text"
        placeholder="Payment Reference"
        value={formData.paymentReference}
        onChange={(e) =>
          setFormData({ ...formData, paymentReference: e.target.value })
        }
      />

      <button type="submit">Confirm Payment</button>
    </form>
  );
};

export default PaymentConfirmation;
```

### Request History Hook

```jsx
import { useState, useEffect } from "react";
import axios from "axios";

const useRequestHistory = (filters = {}) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetchRequests = async (page = 1) => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page,
        limit: 10,
        ...filters,
      });

      const response = await axios.get(
        `/request-history/employer/history?${params}`
      );

      setRequests(response.data.requests);
      setPagination(response.data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  return { requests, loading, error, pagination, refetch: fetchRequests };
};

export default useRequestHistory;
```

## 🚨 Error Handling

### Error Response Format

```json
{
  "error": "Error message description",
  "status": 400
}
```

### Common Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `500`: Internal Server Error

### Error Handling Example

```jsx
const handleApiCall = async () => {
  try {
    const response = await axios.post("/api/endpoint", data);
    // Handle success
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 400:
          console.error("Validation error:", data.error);
          break;
        case 401:
          window.location.href = "/login";
          break;
        case 500:
          console.error("Server error:", data.error);
          break;
        default:
          console.error("Error:", data.error);
      }
    }
  }
};
```

## 🔒 Security Considerations

1. **Token Storage**: Use httpOnly cookies or secure localStorage
2. **Input Validation**: Validate all inputs on frontend
3. **Rate Limiting**: Implement request throttling
4. **CORS**: Ensure proper CORS configuration

## 📱 Mobile Responsiveness

### CSS Media Queries

```css
/* Mobile first */
.request-history {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .request-history {
    padding: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .request-history {
    padding: 3rem;
  }
}
```

## 🧪 Testing

### API Testing

```javascript
import axios from "axios";

describe("Request History API", () => {
  test("should fetch request history", async () => {
    const mockResponse = { data: { requests: [], pagination: {} } };
    axios.get.mockResolvedValue(mockResponse);

    const result = await getRequestHistory();
    expect(result).toEqual(mockResponse.data);
  });
});
```

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs/)
- [Express.js Docs](https://expressjs.com/)
- [Axios](https://axios-http.com/)
- [React Query](https://tanstack.com/query)

---

**Note**: For production, ensure proper security measures and SSL certificates.
