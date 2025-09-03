# New Employer Request & Payment Workflow Implementation

## 🎯 Desired Workflow

### Step 1: Initial Request

- Employer submits request
- System automatically sets `firstPaymentRequired = true`
- Status: `first_payment_required`
- **Notification**: "Please pay 5,000 RWF (non-refundable) to access partial candidate information"

### Step 2: First Payment (5,000 RWF - Non-refundable)

- Employer pays first installment
- System automatically confirms payment
- Status: `first_payment_confirmed`
- **Access granted**: **Photo access only**
- **Notification**: "First payment confirmed! You now have access to candidate photo. Admin will review and request second payment for full details."

### Step 3: Admin Reviews & Requests Second Payment

- **Admin manually reviews** the request and candidate
- **Admin decides** if they want to proceed with full details
- **Admin requests second payment** for full candidate details
- Status: `second_payment_required`
- **Notification**: "Admin has requested second payment for full candidate details"

### Step 4: Second Payment Confirmation

- Employer pays admin-requested amount
- System automatically confirms payment
- Status: `second_payment_confirmed`
- **Access granted**: **Full candidate details** (contact info, complete profile)
- **Notification**: "Second payment confirmed! You now have full access to candidate information."

### Step 5: Completion

- Status: `completed`
- **Job seeker removed** from available list
- **Request deactivated** (no longer active)
- **Notification**: "Deal completed! Candidate has been matched and is no longer available."

## 🔧 Implementation Changes Needed

### 1. Backend Controller Updates

#### A. Update Employer Request Creation

```javascript
// In employerController.js - submitEmployerRequest
const employerRequest = await prisma.employerRequest.create({
  data: {
    employerAccountId: employerAccount.id,
    message,
    requestedCandidateId: requestedCandidateId
      ? parseInt(requestedCandidateId, 10)
      : null,
    priority: priority || "normal",
    status: "first_payment_required",

    // New workflow fields
    firstPaymentRequired: true,
    firstPaymentAmount: 5000.0,
    firstPaymentConfirmed: false,

    secondPaymentRequired: true, // Will be set based on candidate
    secondPaymentAmount: calculateSecondPaymentAmount(requestedCandidateId),
    secondPaymentConfirmed: false,
  },
});

// Create initial progress
await prisma.requestProgress.create({
  data: {
    employerRequestId: employerRequest.id,
    stage: "first_payment_required",
    status: "completed",
    description:
      "Employer request received. First payment of 5,000 RWF (non-refundable) required for partial access.",
    completedAt: new Date(),
  },
});

// Send notification
await sendNotification(employerAccount.userId, {
  type: "payment_request",
  title: "Payment Required",
  message:
    "Please pay 5,000 RWF (non-refundable) to access partial candidate information.",
});
```

#### B. Update Payment Confirmation Logic

```javascript
// In paymentController.js - confirmPayment
exports.confirmPayment = async (req, res) => {
  // ... existing validation ...

  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId, 10) },
    include: {
      employerRequest: {
        include: {
          employerAccount: { include: { user: true } },
          requestedCandidate: true,
        },
      },
    },
  });

  // Update payment status
  const updatedPayment = await prisma.payment.update({
    where: { id: parseInt(paymentId, 10) },
    data: {
      status: "confirmed",
      confirmationName,
      confirmationPhone,
      confirmationDate: new Date(),
      paymentReference: paymentReference || `CONF_${Date.now()}`,
    },
  });

  // Handle workflow based on payment type
  if (payment.paymentType === "first_installment") {
    await handleFirstPaymentConfirmation(payment.employerRequestId);
  } else if (payment.paymentType === "second_installment") {
    await handleSecondPaymentConfirmation(payment.employerRequestId);
  }
};

async function handleFirstPaymentConfirmation(employerRequestId) {
  const prisma = await getPrismaClient();

  // Update employer request
  await prisma.employerRequest.update({
    where: { id: employerRequestId },
    data: {
      status: "first_payment_confirmed",
      firstPaymentConfirmed: true,
      firstPaymentConfirmedAt: new Date(),
      partialAccessGranted: true,
    },
  });

  // Create progress
  await prisma.requestProgress.create({
    data: {
      employerRequestId,
      stage: "first_payment_confirmed",
      status: "completed",
      description: "First payment confirmed. Partial access granted.",
      completedAt: new Date(),
    },
  });

  // Grant partial access
  await prisma.requestProgress.create({
    data: {
      employerRequestId,
      stage: "partial_access_granted",
      status: "completed",
      description:
        "Employer now has access to candidate photo and basic information.",
      completedAt: new Date(),
    },
  });

  // Request second payment
  await requestSecondPayment(employerRequestId);
}

async function handleSecondPaymentConfirmation(employerRequestId) {
  const prisma = await getPrismaClient();

  // Update employer request
  await prisma.employerRequest.update({
    where: { id: employerRequestId },
    data: {
      status: "second_payment_confirmed",
      secondPaymentConfirmed: true,
      secondPaymentConfirmedAt: new Date(),
      fullAccessGranted: true,
    },
  });

  // Create progress
  await prisma.requestProgress.create({
    data: {
      employerRequestId,
      stage: "second_payment_confirmed",
      status: "completed",
      description: "Second payment confirmed. Full access granted.",
      completedAt: new Date(),
    },
  });

  // Grant full access
  await prisma.requestProgress.create({
    data: {
      employerRequestId,
      stage: "full_access_granted",
      status: "completed",
      description: "Employer now has access to complete candidate information.",
      completedAt: new Date(),
    },
  });

  // Complete the deal
  await completeDeal(employerRequestId);
}

async function completeDeal(employerRequestId) {
  const prisma = await getPrismaClient();

  const employerRequest = await prisma.employerRequest.findUnique({
    where: { id: employerRequestId },
    include: {
      requestedCandidate: true,
      employerAccount: { include: { user: true } },
    },
  });

  // Update employer request to completed
  await prisma.employerRequest.update({
    where: { id: employerRequestId },
    data: {
      status: "completed",
      isCompleted: true,
      completedAt: new Date(),
      isActive: false, // Deactivate the request
      deactivatedAt: new Date(),
    },
  });

  // Remove job seeker from available list
  if (employerRequest.requestedCandidateId) {
    await prisma.user.update({
      where: { id: employerRequest.requestedCandidateId },
      data: {
        isAvailableForMatching: false,
        matchedAt: new Date(),
        matchedWithEmployerId: employerRequestId,
      },
    });
  }

  // Create completion progress
  await prisma.requestProgress.create({
    data: {
      employerRequestId,
      stage: "completed",
      status: "completed",
      description:
        "Deal completed! Candidate has been matched and is no longer available.",
      completedAt: new Date(),
    },
  });

  // Send completion notification
  await sendNotification(employerRequest.employerAccount.userId, {
    type: "completion",
    title: "Deal Completed",
    message:
      "Congratulations! The candidate has been matched and is no longer available to other employers.",
  });
}
```

### 2. Frontend Updates

#### A. Update Employer Dashboard

- Show payment progress with visual indicators
- Display current stage and next steps
- Show partial vs full access status
- Display candidate information based on access level

#### B. Update Admin Dashboard

- Show all employer requests with new statuses
- Display payment progress for each request
- Show which candidates are no longer available
- Track completion statistics

### 3. Notification System

#### A. Email Notifications

- First payment request
- First payment confirmation
- Second payment request
- Second payment confirmation
- Deal completion

#### B. In-App Notifications

- Real-time notifications in dashboard
- Progress tracking
- Status updates

### 4. Public Job Seekers Page Updates

- Filter out matched candidates (isAvailableForMatching = false)
- Show only available candidates
- Update candidate count dynamically

## 🚀 Implementation Priority

1. **Database Schema Updates** (High Priority)
2. **Backend Controller Updates** (High Priority)
3. **Notification System** (Medium Priority)
4. **Frontend UI Updates** (Medium Priority)
5. **Testing & Validation** (High Priority)

## 📊 Benefits of New System

1. **Automated Workflow** - Reduces manual admin intervention
2. **Clear Payment Structure** - Two-installment system with non-refundable first payment
3. **Automatic Candidate Management** - Removes matched candidates from available list
4. **Better Tracking** - Comprehensive progress tracking and notifications
5. **Improved User Experience** - Clear next steps and status updates
6. **Reduced Admin Workload** - Automated confirmations and status updates
