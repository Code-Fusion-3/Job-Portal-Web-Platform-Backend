# Implementation Plan for New Payment Workflow

## 🎯 Phase 1: Database Schema Updates

### 1.1 Update Prisma Schema

```prisma
// Add to EmployerRequest model
firstPaymentRequired      Boolean           @default(true)
firstPaymentAmount        Decimal?          @default(5000.00) @db.Decimal(10, 2)
firstPaymentConfirmed     Boolean           @default(false)
firstPaymentConfirmedAt   DateTime?

secondPaymentRequired     Boolean           @default(false)
secondPaymentAmount       Decimal?          @db.Decimal(10, 2)
secondPaymentConfirmed    Boolean           @default(false)
secondPaymentConfirmedAt  DateTime?

partialAccessGranted      Boolean           @default(false)
fullAccessGranted         Boolean           @default(false)
isCompleted               Boolean           @default(false)
completedAt               DateTime?
isActive                  Boolean           @default(true)
deactivatedAt             DateTime?

// Add to Payment model
installmentNumber         Int               @default(1)
isNonRefundable           Boolean           @default(false)

// Add to User model
isAvailableForMatching    Boolean           @default(true)
matchedAt                 DateTime?
matchedWithEmployerId     Int?
```

### 1.2 Create Migration

```bash
npx prisma db push
npx prisma generate
```

## 🎯 Phase 2: Backend Controller Updates

### 2.1 Update Employer Request Creation

**File**: `job-portal-backend/controllers/employerController.js`

**Changes needed**:

- Set default first payment amount to 5,000 RWF
- Set status to `first_payment_required`
- Create initial progress tracking
- Send first payment notification
- **Grant photo access only** after first payment confirmation
- **Wait for admin review** before requesting second payment

### 2.2 Update Payment Confirmation Logic

**File**: `job-portal-backend/controllers/paymentController.js`

**Changes needed**:

- Add installment number tracking
- Implement automatic workflow progression for first payment
- **Add admin-triggered second payment request**
- Add job seeker availability management
- Implement request deactivation

### 2.3 Create New Notification System

**File**: `job-portal-backend/controllers/notificationController.js` (NEW)

**Features**:

- Email notifications for each stage
- In-app notification storage
- Automatic notification triggers

## 🎯 Phase 3: Frontend Updates

### 3.1 Update Employer Dashboard

**File**: `job-portal/src/pages/dashboard/EmployerDashboard.jsx`

**Changes needed**:

- Show payment progress indicators
- Display access level (partial/full)
- Show next steps based on current stage
- Update candidate information display

### 3.2 Update Admin Dashboard

**File**: `job-portal/src/pages/dashboard/AdminDashboard.jsx`

**Changes needed**:

- Show new request statuses
- Display payment progress
- Show matched candidates
- Track completion statistics

### 3.3 Update Public Job Seekers Page

**File**: `job-portal/src/pages/JobSeekers.jsx`

**Changes needed**:

- Filter out matched candidates
- Update candidate count
- Show only available candidates

## 🎯 Phase 4: API Endpoint Updates

### 4.1 New Endpoints Needed

```
// Admin endpoints
POST /api/admin/employer-requests/:id/approve
POST /api/admin/employer-requests/:id/reject
POST /api/admin/payments/:id/approve
POST /api/admin/payments/:id/reject
POST /api/admin/employer-requests/:id/request-second-payment
POST /api/admin/employer-requests/:id/approve-full-details-request
POST /api/admin/employer-requests/:id/update-candidate-availability

// Employer endpoints
POST /api/employer-requests/:id/mark-hired
POST /api/employer-requests/:id/mark-not-hired
POST /api/employer-requests/:id/request-full-details
GET /api/employer-requests/:id/photo-access
GET /api/employer-requests/:id/full-details

// Candidate endpoints
GET /api/candidate/requests (notifications about requests)
```

### 4.2 Updated Endpoints

```
PUT /api/payments/:id/confirm (enhanced workflow)
GET /api/employer-requests (new statuses)
GET /api/public/job-seekers (filter matched candidates)
```

## 🎯 Phase 5: Testing & Validation

### 5.1 Test Scenarios

1. **Complete Workflow Test**
   - Submit request → First payment → Second payment → Completion
2. **Partial Workflow Test**
   - Submit request → First payment only
3. **Error Handling Test**

   - Invalid payments, network errors, etc.

4. **Notification Test**
   - Verify all notifications are sent
   - Test email delivery
   - Test in-app notifications

### 5.2 Data Migration

- Update existing requests to new schema
- Set appropriate statuses for existing data
- Ensure backward compatibility

## 🎯 Phase 6: Deployment & Monitoring

### 6.1 Deployment Steps

1. Deploy database changes
2. Deploy backend updates
3. Deploy frontend updates
4. Run data migration scripts
5. Monitor system performance

### 6.2 Monitoring

- Track payment success rates
- Monitor notification delivery
- Track completion rates
- Monitor system performance

## 📊 Success Metrics

1. **Payment Completion Rate**: >90% of first payments completed
2. **Second Payment Rate**: >80% of first payments lead to second payments
3. **Deal Completion Rate**: >70% of second payments lead to completion
4. **Notification Delivery**: >95% of notifications delivered successfully
5. **System Performance**: <2s response time for all endpoints

## 🚨 Risk Mitigation

1. **Backward Compatibility**: Ensure existing requests continue to work
2. **Data Integrity**: Validate all data migrations
3. **Error Handling**: Comprehensive error handling for all scenarios
4. **Rollback Plan**: Ability to rollback changes if issues arise
5. **Testing**: Extensive testing before production deployment

## 📅 Timeline Estimate

- **Phase 1**: 2-3 days (Database schema)
- **Phase 2**: 5-7 days (Backend controllers)
- **Phase 3**: 4-5 days (Frontend updates)
- **Phase 4**: 2-3 days (API endpoints)
- **Phase 5**: 3-4 days (Testing)
- **Phase 6**: 1-2 days (Deployment)

**Total Estimated Time**: 17-24 days

## 🔧 Development Environment Setup

1. **Database**: Update local Prisma schema
2. **Backend**: Implement new controllers
3. **Frontend**: Update UI components
4. **Testing**: Set up test environment
5. **Staging**: Deploy to staging environment
6. **Production**: Deploy to production with monitoring
