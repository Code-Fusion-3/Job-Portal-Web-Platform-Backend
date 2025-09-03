# Updated Workflow with Admin Approval at Each Step

## 🎯 Complete Workflow with Admin Control

### Step 1: Initial Request

- Employer submits request
- Status: `pending`
- **Notification to Admin**: "New employer request received"
- **Notification to Candidate**: "Someone has requested your services (details hidden)"

### Step 2: Admin Approves Request

- **Admin reviews and approves** the request
- Status: `approved`
- **First payment requested** (5,000 RWF)
- Status: `first_payment_required`
- **Notification to Employer**: "Request approved! Pay 5,000 RWF for photo access"

### Step 3: First Payment Confirmation

- Employer pays first installment
- Employer confirms payment
- Status: `first_payment_confirmed`
- **Admin reviews payment confirmation**
- **Admin approves payment**
- **Photo access granted**
- Status: `photo_access_granted`
- **Notification to Employer**: "Payment approved! You now have photo access"

### Step 4: Second Payment Request (Admin or Employer Initiated)

**Option A: Admin Requests Second Payment**

- **Admin reviews** the request and candidate
- **Admin decides** to proceed with full details
- **Admin requests second payment**
- Status: `second_payment_required`
- **Notification to Employer**: "Admin requests second payment for full details"

**Option B: Employer Requests Full Details**

- **Employer can request** full details if admin takes too long
- Status: `full_details_requested`
- **Notification to Admin**: "Employer requests full details access"
- **Admin reviews** the request and candidate
- **Admin approves or rejects** the request
- If approved: Status: `second_payment_required`
- **Notification to Employer**: "Your request for full details has been approved. Please pay the required amount."

### Step 5: Second Payment Confirmation

- Employer pays second installment
- Employer confirms payment
- Status: `second_payment_confirmed`
- **Admin reviews payment confirmation**
- **Admin approves payment**
- **Full access granted**
- Status: `full_access_granted`
- **Notification to Employer**: "Payment approved! You now have full access"

### Step 6: Hiring Decision

- **Employer marks candidate as hired or not hired**
- Status: `hiring_decision_made`
- **Admin reviews hiring decision**
- **Admin updates candidate availability** on job seeker page
- Status: `completed`
- **Candidate removed from available list**
- **Notification to Candidate**: "You have been matched with an employer"

## 🔧 Implementation Changes Needed

### 1. Database Schema Updates

```prisma
model EmployerRequest {
  // ... existing fields ...

  // Updated statuses: pending | approved | first_payment_required | first_payment_confirmed | photo_access_granted | full_details_requested | second_payment_required | second_payment_confirmed | full_access_granted | hiring_decision_made | completed | cancelled

  // Admin approval tracking
  requestApprovedBy        Int?
  requestApprovedAt        DateTime?
  firstPaymentApprovedBy   Int?
  firstPaymentApprovedAt   DateTime?
  secondPaymentApprovedBy  Int?
  secondPaymentApprovedAt  DateTime?

  // Hiring decision
  hiringDecision           String?  @db.VarChar(20) // hired | not_hired
  hiringDecisionMadeBy     Int?
  hiringDecisionMadeAt     DateTime?
  hiringDecisionNotes      String?  @db.Text

  // Candidate notification
  candidateNotified        Boolean  @default(false)
  candidateNotifiedAt      DateTime?
}
```

### 2. New API Endpoints

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

### 3. Backend Controller Updates

#### A. Admin Request Approval

```javascript
// In adminController.js
exports.approveEmployerRequest = async (req, res) => {
  const { requestId } = req.params;
  const { notes } = req.body;

  const employerRequest = await prisma.employerRequest.update({
    where: { id: parseInt(requestId, 10) },
    data: {
      status: "approved",
      requestApprovedBy: req.user.id,
      requestApprovedAt: new Date(),
      firstPaymentRequired: true,
      firstPaymentAmount: 5000.0,
    },
  });

  // Create first payment request
  await createFirstPaymentRequest(employerRequest.id);

  // Send notification to employer
  await sendNotification(employerRequest.employerAccount.userId, {
    type: "request_approved",
    title: "Request Approved",
    message:
      "Your request has been approved! Please pay 5,000 RWF for photo access.",
  });

  res.json({ message: "Request approved successfully" });
};
```

#### B. Payment Approval

```javascript
exports.approvePayment = async (req, res) => {
  const { paymentId } = req.params;
  const { notes } = req.body;

  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId, 10) },
    include: { employerRequest: true },
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: parseInt(paymentId, 10) },
    data: {
      status: "approved",
      adminNotes: notes,
    },
  });

  // Update employer request based on payment type
  if (payment.paymentType === "first_installment") {
    await prisma.employerRequest.update({
      where: { id: payment.employerRequestId },
      data: {
        status: "photo_access_granted",
        firstPaymentApprovedBy: req.user.id,
        firstPaymentApprovedAt: new Date(),
        partialAccessGranted: true,
      },
    });

    // Send notification to employer
    await sendNotification(payment.employerRequest.employerAccount.userId, {
      type: "photo_access_granted",
      title: "Photo Access Granted",
      message:
        "Your payment has been approved! You now have access to candidate photo.",
    });
  } else if (payment.paymentType === "second_installment") {
    await prisma.employerRequest.update({
      where: { id: payment.employerRequestId },
      data: {
        status: "full_access_granted",
        secondPaymentApprovedBy: req.user.id,
        secondPaymentApprovedAt: new Date(),
        fullAccessGranted: true,
      },
    });

    // Send notification to employer
    await sendNotification(payment.employerRequest.employerAccount.userId, {
      type: "full_access_granted",
      title: "Full Access Granted",
      message:
        "Your payment has been approved! You now have full access to candidate details.",
    });
  }

  res.json({ message: "Payment approved successfully" });
};
```

#### C. Employer Requests Full Details

```javascript
// In employerController.js
exports.requestFullDetails = async (req, res) => {
  const { requestId } = req.params;
  const { reason } = req.body; // Optional reason for requesting full details

  const employerRequest = await prisma.employerRequest.findUnique({
    where: { id: parseInt(requestId, 10) },
    include: {
      employerAccount: { include: { user: true } },
      requestedCandidate: true,
    },
  });

  // Check if employer has photo access
  if (employerRequest.status !== "photo_access_granted") {
    return res.status(400).json({
      error: "You must have photo access before requesting full details.",
    });
  }

  // Update request status
  await prisma.employerRequest.update({
    where: { id: parseInt(requestId, 10) },
    data: {
      status: "full_details_requested",
      hiringDecisionNotes: reason ? `Employer request reason: ${reason}` : null,
    },
  });

  // Create progress tracking
  await prisma.requestProgress.create({
    data: {
      employerRequestId: parseInt(requestId, 10),
      stage: "full_details_requested",
      status: "completed",
      description: `Employer requested full details access${
        reason ? `: ${reason}` : ""
      }`,
      completedAt: new Date(),
    },
  });

  // Send notification to admin
  await sendAdminNotification({
    type: "full_details_requested",
    title: "Employer Requests Full Details",
    message: `Employer ${employerRequest.employerAccount.user.name} has requested full details access for candidate. Please review and approve/reject.`,
    requestId: parseInt(requestId, 10),
  });

  res.json({
    message:
      "Full details request submitted successfully. Admin will review your request.",
  });
};
```

#### D. Hiring Decision

```javascript
// In employerController.js
exports.markHiringDecision = async (req, res) => {
  const { requestId } = req.params;
  const { decision, notes } = req.body; // decision: 'hired' | 'not_hired'

  const employerRequest = await prisma.employerRequest.update({
    where: { id: parseInt(requestId, 10) },
    data: {
      status: "hiring_decision_made",
      hiringDecision: decision,
      hiringDecisionMadeBy: req.user.id,
      hiringDecisionMadeAt: new Date(),
      hiringDecisionNotes: notes,
    },
  });

  // Send notification to admin
  await sendAdminNotification({
    type: "hiring_decision_made",
    title: "Hiring Decision Made",
    message: `Employer has marked candidate as ${decision}. Please review and update candidate availability.`,
  });

  res.json({ message: "Hiring decision recorded successfully" });
};
```

#### D. Admin Approves/Rejects Full Details Request

```javascript
// In adminController.js
exports.approveFullDetailsRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action, amount, notes } = req.body; // action: 'approve' | 'reject'

  const employerRequest = await prisma.employerRequest.findUnique({
    where: { id: parseInt(requestId, 10) },
    include: {
      employerAccount: { include: { user: true } },
      requestedCandidate: true,
    },
  });

  if (employerRequest.status !== "full_details_requested") {
    return res.status(400).json({
      error: "Request is not in full_details_requested status.",
    });
  }

  if (action === "approve") {
    // Set second payment amount and request payment
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: "second_payment_required",
        secondPaymentAmount: amount || 10000.0, // Default amount if not specified
        secondPaymentRequired: true,
      },
    });

    // Create second payment request
    await createSecondPaymentRequest(
      parseInt(requestId, 10),
      amount || 10000.0
    );

    // Send notification to employer
    await sendNotification(employerRequest.employerAccount.userId, {
      type: "full_details_approved",
      title: "Full Details Request Approved",
      message: `Your request for full details has been approved. Please pay ${
        amount || 10000
      } RWF to access complete candidate information.`,
    });

    res.json({
      message:
        "Full details request approved. Second payment requested from employer.",
    });
  } else if (action === "reject") {
    // Reject the request and keep photo access only
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: "photo_access_granted",
        hiringDecisionNotes: notes
          ? `Admin rejection reason: ${notes}`
          : "Full details request rejected by admin",
      },
    });

    // Send notification to employer
    await sendNotification(employerRequest.employerAccount.userId, {
      type: "full_details_rejected",
      title: "Full Details Request Rejected",
      message: `Your request for full details has been rejected.${
        notes ? ` Reason: ${notes}` : ""
      } You still have photo access.`,
    });

    res.json({
      message:
        "Full details request rejected. Employer retains photo access only.",
    });
  }
};
```

#### E. Admin Updates Candidate Availability

```javascript
// In adminController.js
exports.updateCandidateAvailability = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // action: 'mark_unavailable' | 'keep_available'

  const employerRequest = await prisma.employerRequest.findUnique({
    where: { id: parseInt(requestId, 10) },
    include: { requestedCandidate: true },
  });

  if (action === "mark_unavailable") {
    // Mark candidate as unavailable
    await prisma.user.update({
      where: { id: employerRequest.requestedCandidateId },
      data: {
        isAvailableForMatching: false,
        matchedAt: new Date(),
        matchedWithEmployerId: parseInt(requestId, 10),
      },
    });

    // Update request status
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: "completed",
        isCompleted: true,
        completedAt: new Date(),
        isActive: false,
      },
    });

    // Send notification to candidate
    await sendNotification(employerRequest.requestedCandidateId, {
      type: "matched_with_employer",
      title: "You Have Been Matched",
      message: "Congratulations! You have been matched with an employer.",
    });
  }

  res.json({ message: "Candidate availability updated successfully" });
};
```

### 4. Frontend Updates

#### A. Admin Dashboard

- Show pending requests for approval
- Show pending payment confirmations
- Show hiring decisions to review
- Show candidate availability management

#### B. Employer Dashboard

- Show request approval status
- Show payment approval status
- Show access level (photo/full)
- Show hiring decision form after full access

#### C. Candidate Dashboard

- Show request notifications (without employer details)
- Show matching status
- Show availability status

### 5. Notification System

#### A. Email Notifications

- Request received (to admin)
- Request approved (to employer)
- Payment approved (to employer)
- Access granted (to employer)
- Hiring decision made (to admin)
- Candidate matched (to candidate)

#### B. In-App Notifications

- Real-time status updates
- Progress tracking
- Action required notifications

## 🎯 Benefits of Updated Workflow

1. **Full Admin Control** - Admin approves every step
2. **Better Security** - No automatic access grants
3. **Quality Control** - Admin can reject at any stage
4. **Candidate Protection** - Details hidden until approved
5. **Flexible Pricing** - Admin sets second payment amount
6. **Hiring Tracking** - Clear hiring decision process
7. **Availability Management** - Admin controls candidate availability
8. **Transparent Process** - All parties know the status

## 📊 Status Flow

```
pending → approved → first_payment_required → first_payment_confirmed →
photo_access_granted → [full_details_requested] → second_payment_required →
second_payment_confirmed → full_access_granted → hiring_decision_made → completed
```

**Note**: `full_details_requested` is an optional status that occurs when employer requests full details before admin initiates it.

Each step requires admin approval except for:

- Employer payment confirmation
- Employer hiring decision
