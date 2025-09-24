const { getPrismaClient } = require('../utils/database');
const { getAnonymizedJobSeekerData } = require('../utils/dataAnonymizer');
const bcrypt = require('bcrypt');
const { generateRandomPassword } = require('../utils/passwordGenerator');
const { sendAdminReplyNotification, sendCandidatePictureNotification, sendCandidateFullDetailsNotification, sendStatusUpdateNotification } = require('../utils/notificationMailer');
const { sendEmployerRequestNotification } = require('../utils/mailer');
const { getAdminEmail } = require('../utils/adminUtils');
const PaymentService = require('../services/paymentService');
const NotificationService = require('../services/notificationService');

// Helper to check candidate notification opt-out
async function checkCandidateNotificationOptOut(userId, type) {
  const prisma = await getPrismaClient();
  const pref = await prisma.notificationPreference.findFirst({
    where: { userId, type }
  });
  return pref && pref.optedOut;
}

// PATCH: Guard against undefined id/userId in employerAccount.findUnique
async function safeFindEmployerAccount(prisma, { id, userId }, include) {
  if (!id && !userId) {
    throw new Error('EmployerAccount lookup requires id or userId');
  }
  return await prisma.employerAccount.findUnique({
    where: id ? { id } : { userId },
    include
  });
}

// Prisma client is managed by the database utility

// Public: Submit employer request (no login required)
exports.submitEmployerRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { name, email, phoneNumber, companyName, message, requestedCandidateId, priority } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }

    // Validate requested candidate if provided
    if (requestedCandidateId) {
      const candidate = await prisma.user.findUnique({
        where: { id: parseInt(requestedCandidateId, 10) },
        include: { profile: true }
      });

      if (!candidate || candidate.role !== 'jobseeker') {
        return res.status(400).json({ error: 'Invalid candidate ID or candidate not found.' });
      }
    }

    // Check if employer account exists, if not create one
    let employerAccount = null;
    let existingUser = null;

    console.log(`🔍 Checking for existing user with email: ${email}`);

    // First, find the user by email
    existingUser = await prisma.user.findUnique({
      where: { email },
      include: {
        employerAccounts: true
      }
    });

    if (existingUser) {
      console.log(`✅ Found existing user: ${existingUser.id}, role: ${existingUser.role}, employer accounts: ${existingUser.employerAccounts.length}`);

      // User exists - check if they already have an employer account
      if (existingUser.employerAccounts.length > 0) {
        // User exists and has employer account(s)
        employerAccount = existingUser.employerAccounts[0];
        console.log(`✅ Using existing employer account: ${employerAccount.id}`);
      } else if (existingUser.role === 'employer') {
        // User exists with employer role but no employer account - create one
        console.log(`🔄 Creating employer account for existing employer user`);
        employerAccount = await prisma.employerAccount.create({
          data: {
            userId: existingUser.id,
            phoneNumber,
            companyName
          }
        });
        console.log(`✅ Created employer account: ${employerAccount.id}`);
      } else {
        // User exists but with different role (e.g., jobseeker) - update role and create employer account
        console.log(`🔄 Updating user role from ${existingUser.role} to employer and creating employer account`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: 'employer' }
        });

        employerAccount = await prisma.employerAccount.create({
          data: {
            userId: existingUser.id,
            phoneNumber,
            companyName
          }
        });
        console.log(`✅ Updated user role and created employer account: ${employerAccount.id}`);
      }
    }

    if (!employerAccount) {
      // No existing user - create new user and employer account
      console.log(`🆕 Creating new user and employer account`);
      const randomPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Create user record
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'employer'
        }
      });
      console.log(`✅ Created new user: ${user.id}`);

      // Create employer account
      employerAccount = await prisma.employerAccount.create({
        data: {
          userId: user.id,
          phoneNumber,
          companyName
        }
      });
      console.log(`✅ Created new employer account: ${employerAccount.id}`);

      // Store the plain password temporarily for email
      employerAccount.plainPassword = randomPassword;
    }

    // Create employer request linked to account
    const employerRequest = await prisma.employerRequest.create({
      data: {
        employerAccountId: employerAccount.id,
        message,
        requestedCandidateId: requestedCandidateId ? parseInt(requestedCandidateId, 10) : null,
        priority: priority || 'normal',
        // Set default payment requirements
        paymentRequired: true,
        paymentAmount: 5000.00,
        paymentCurrency: 'RWF',
        paymentDescription: 'Initial non-refundable fee for worker/service details access'
      }
    });

    // Create initial progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: employerRequest.id,
        stage: 'request_received',
        status: 'completed',
        description: 'Employer request received and under review. Initial payment of 5,000 Frw required.',
        completedAt: new Date()
      }
    });

    // Create payment required progress
    await prisma.requestProgress.create({
      data: {
        employerRequestId: employerRequest.id,
        stage: 'payment_required',
        status: 'pending',
        description: 'Initial payment of 5,000 Frw required to proceed with worker details access.',
        adminNotes: 'Employer needs to pay initial fee before receiving additional information'
      }
    });

    // Get admin email and send notification
    try {
      const adminEmail = await getAdminEmail();
      // Send to admin
      await sendEmployerRequestNotification(name, email, message, phoneNumber, companyName, requestedCandidateId, adminEmail, priority);

      // Send to employer with login credentials if new account
      if (employerAccount.plainPassword) {
        await sendEmployerRequestNotification(
          name,
          email,
          message,
          phoneNumber,
          companyName,
          requestedCandidateId,
          email,
          priority,
          employerAccount.plainPassword // Pass the plain password for email
        );
      } else {
        // Send regular notification for existing accounts
        await sendEmployerRequestNotification(name, email, message, phoneNumber, companyName, requestedCandidateId, email, priority);
      }
    } catch (emailError) {
      console.error('Failed to send employer request notification:', emailError);
      // Continue even if email fails
    }

    // After creating the employer request, send an email to the candidate if requestedCandidateId is present
    if (employerRequest.requestedCandidateId) {
      try {
        // Fetch candidate email
        const candidate = await prisma.user.findUnique({ where: { id: employerRequest.requestedCandidateId } });
        if (candidate && candidate.email) {
          // Send email notification to candidate
          await sendStatusUpdateNotification(
            candidate.email,
            candidate.name || 'Candidate',
            'request_received',
            null,
            {
              id: employerRequest.id,
              message: employerRequest.message,
              companyName: employerAccount.companyName,
              phoneNumber: employerAccount.phoneNumber
            }
          );
          // Log success
          console.log(`✅ Email sent to candidate ${candidate.email} for request #${employerRequest.id}`);
        } else {
          console.warn(`⚠️ Candidate email not found for userId ${employerRequest.requestedCandidateId}`);
        }
      } catch (emailError) {
        console.error('❌ Failed to send candidate request notification email:', emailError);
        // Continue even if email fails
      }
    }

    // Send WebSocket notification
    if (global.wsServer) {
      global.wsServer.notifyNewRequest(employerRequest);
      global.wsServer.notifyDashboardUpdate();
    }

    // Prepare response with login credentials if new account was created
    const response = {
      message: 'Employer request submitted successfully',
      request: {
        id: employerRequest.id,
        status: employerRequest.status,
        priority: employerRequest.priority,
        createdAt: employerRequest.createdAt
      }
    };

    // If this is a new account, include login credentials
    if (employerAccount.plainPassword) {
      response.loginCredentials = {
        email,
        password: employerAccount.plainPassword,
        message: 'Your account has been created. Please save these credentials to access your dashboard.'
      };
    }
console.log('Final response: ',response);
    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit request.' });
  }
};

// Removed incomplete function

// Admin: Get request statistics
exports.getRequestStats = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { period = '30' } = req.query; // Default to last 30 days
    const days = parseInt(period);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get status counts
    const statusCounts = await prisma.employerRequest.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Get priority counts
    const priorityCounts = await prisma.employerRequest.groupBy({
      by: ['priority'],
      _count: {
        priority: true
      }
    });

    // Get recent requests (last 7 days)
    const recentRequests = await prisma.employerRequest.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    });

    // Get requests with selected candidates
    const requestsWithCandidates = await prisma.employerRequest.count({
      where: {
        selectedUserId: {
          not: null
        }
      }
    });

    // Get approved requests count
    const approvedRequests = await prisma.employerRequest.count({
      where: {
        status: 'approved'
      }
    });

    // Get monthly trend (last 6 months)
    const monthlyTrend = await prisma.employerRequest.groupBy({
      by: ['createdAt'],
      _count: {
        id: true
      },
      where: {
        createdAt: {
          gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    // Format monthly trend data
    const monthlyData = monthlyTrend.reduce((acc, item) => {
      const month = item.createdAt.toISOString().slice(0, 7); // YYYY-MM format
      acc[month] = (acc[month] || 0) + item._count.id;
      return acc;
    }, {});

    // Format status counts
    const statusSummary = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    // Format priority counts
    const prioritySummary = priorityCounts.reduce((acc, item) => {
      acc[item.priority] = item._count.priority;
      return acc;
    }, {});

    res.json({
      summary: {
        totalRequests: Object.values(statusSummary).reduce((a, b) => a + b, 0),
        recentRequests,
        requestsWithCandidates,
        approvedRequests
      },
      statusCounts: statusSummary,
      priorityCounts: prioritySummary,
      monthlyTrend: monthlyData,
      period: `${days} days`
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch request statistics.' });
  }
};

// Admin: Get specific employer request with messages
exports.getEmployerRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const requestId = parseInt(req.params.id, 10);

    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId },
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                contactNumber: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Get requested candidate details if available
    let requestWithCandidate = request;
    if (request.requestedCandidateId) {
      const candidate = await prisma.user.findUnique({
        where: { id: request.requestedCandidateId },
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
              contactNumber: true
            }
          }
        }
      });
      requestWithCandidate = {
        ...request,
        requestedCandidate: candidate
      };
    }

    res.json(requestWithCandidate);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch employer request.' });
  }
};

// Admin: Reply to employer request
exports.replyToEmployerRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const requestId = parseInt(req.params.id, 10);
    const { content } = req.body;
    const adminUser = req.user; // Get admin user from auth middleware

    console.log(`📧 Admin reply attempt - Request ID: ${requestId}, Admin: ${adminUser?.email || 'Unknown'}`);

    if (!content) {
      console.log('❌ Reply failed: Missing content');
      return res.status(400).json({ error: 'Message content is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId },
      include: {
        employerAccount: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!request) {
      console.log(`❌ Reply failed: Request not found - ID: ${requestId}`);
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    console.log(`📋 Request details - Employer: ${request.employerAccount?.user?.name || 'Employer'} (${request.employerAccount?.user?.email}), Status: ${request.status}`);

    // Check if request is approved - block further communication
    if (request.status === 'approved') {
      console.log(`❌ Reply blocked: Request already approved - ID: ${requestId}`);
      return res.status(400).json({
        error: 'Cannot send messages for approved requests. Communication is closed after approval.'
      });
    }

    // Check if request is cancelled or completed
    if (request.status === 'cancelled' || request.status === 'completed') {
      console.log(`❌ Reply blocked: Request ${request.status} - ID: ${requestId}`);
      return res.status(400).json({
        error: `Cannot send messages for ${request.status} requests.`
      });
    }

    // Create message from admin
    const message = await prisma.message.create({
      data: {
        employerRequestId: requestId,
        fromAdmin: true,
        employerEmail: request.employerAccount?.user?.email,
        content,
        messageType: 'admin_reply'
      }
    });

    console.log(`✅ Message saved to database - Message ID: ${message.id}`);

    // Send email notification to employer
    let emailSent = false;
    try {
      console.log(`📤 Sending email to employer: ${request.employerAccount?.user?.email}`);
      await sendAdminReplyNotification(request.employerAccount?.user?.email, request.employerAccount?.user?.name || 'Employer', content);
      emailSent = true;
      console.log(`✅ Email sent successfully to: ${request.employerAccount?.user?.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send admin reply notification:', emailError);
      // Continue even if email fails
    }

    // Log the reply action
    console.log(`📝 Reply completed - Request: ${requestId}, Employer: ${request.employerAccount?.user?.name || 'Employer'}, Email: ${emailSent ? 'Sent' : 'Failed'}`);

    res.status(201).json({
      message: 'Reply sent successfully',
      messageData: {
        ...message,
        emailSent,
        employerName: request.employerAccount?.user?.name || 'Employer',
        employerEmail: request.employerAccount?.user?.email
      }
    });
  } catch (err) {
    console.error('❌ Reply error:', err);
    res.status(500).json({ error: err.message || 'Failed to send reply.' });
  }
};

// Admin: Select a job seeker for employer request
exports.selectJobSeekerForRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const requestId = parseInt(req.params.id, 10);
    const { selectedUserId, detailsType = 'picture' } = req.body;
    const adminUser = req.user; // Get admin user from auth middleware

    console.log(`👤 Candidate selection attempt - Request ID: ${requestId}, Candidate: ${selectedUserId}, Details: ${detailsType}, Admin: ${adminUser?.email || 'Unknown'}`);

    if (!selectedUserId) {
      console.log('❌ Selection failed: Missing selected user ID');
      return res.status(400).json({ error: 'Selected user ID is required.' });
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      console.log(`❌ Selection failed: Request not found - ID: ${requestId}`);
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    console.log(`📋 Request details - Employer: ${request.employerAccount?.user?.name || 'Employer'} (${request.employerAccount?.user?.email}), Status: ${request.status}`);

    // Check if request is already approved
    if (request.status === 'approved') {
      console.log(`❌ Selection blocked: Request already approved - ID: ${requestId}`);
      return res.status(400).json({
        error: 'Cannot select candidate for approved requests.'
      });
    }

    // Check if selected user exists and is a job seeker
    const selectedUser = await prisma.user.findUnique({
      where: { id: selectedUserId },
      include: {
        profile: {
          select: {
            firstName: true,
            lastName: true,
            skills: true,
            experience: true,
            experienceLevel: true,
            educationLevel: true,
            location: true,
            city: true,
            country: true,
            contactNumber: true,
            monthlyRate: true,
            availability: true,
            languages: true,
            certifications: true,
            description: true,
            gender: true,
            maritalStatus: true,
            idNumber: true,
            references: true,
            jobCategory: {
              select: {
                id: true,
                name_en: true,
                name_rw: true
              }
            }
          }
        }
      }
    });

    if (!selectedUser || selectedUser.role !== 'jobseeker') {
      console.log(`❌ Selection failed: Job seeker not found - ID: ${selectedUserId}`);
      return res.status(404).json({ error: 'Selected job seeker not found.' });
    }

    console.log(`✅ Candidate found: ${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}`);

    // Update request with selected user
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: {
        selectedUserId,
        status: 'in_progress' // Update status to in progress
      },
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                educationLevel: true,
                location: true,
                city: true,
                country: true,
                contactNumber: true,
                monthlyRate: true,
                availability: true,
                languages: true,
                certifications: true,
                description: true,
                gender: true,
                maritalStatus: true,
                idNumber: true,
                references: true,
                jobCategory: {
                  select: {
                    id: true,
                    name_en: true,
                    name_rw: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`✅ Request updated with selected candidate - Request ID: ${requestId}`);

    // Send email notification to employer based on details type
    let emailSent = false;
    try {
      console.log(`📤 Sending candidate selection email to employer: ${request.employerAccount?.user?.email}`);

      if (detailsType === 'picture') {
        await sendCandidatePictureNotification(request.employerAccount?.user?.email, request.employerAccount?.user?.name || 'Employer', selectedUser);
      } else {
        await sendCandidateFullDetailsNotification(request.employerAccount?.user?.email, request.employerAccount?.user?.name || 'Employer', selectedUser);
      }

      emailSent = true;
      console.log(`✅ Candidate selection email sent successfully to: ${request.employerAccount?.user?.email}`);
    } catch (emailError) {
      console.error('❌ Failed to send candidate selection notification:', emailError);
      // Continue even if email fails
    }

    // Log the selection action
    console.log(`📝 Candidate selection completed - Request: ${requestId}, Employer: ${request.employerAccount?.user?.name || 'Employer'}, Candidate: ${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}, Details: ${detailsType}, Email: ${emailSent ? 'Sent' : 'Failed'}`);

    res.json({
      message: 'Job seeker selected successfully',
      request: {
        ...updatedRequest,
        emailSent,
        detailsType,
        employerName: request.employerAccount?.user?.name || 'Employer',
        employerEmail: request.employerAccount?.user?.email,
        candidateName: `${selectedUser.profile?.firstName} ${selectedUser.profile?.lastName}`
      }
    });
  } catch (err) {
    console.error('❌ Selection error:', err);
    res.status(500).json({ error: err.message || 'Failed to select job seeker.' });
  }
};

// Refactor approval transition
exports.approveEmployerRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const requestId = parseInt(req.params.id, 10);
    const { adminNotes, paymentMethodId } = req.body;
    // Check if request exists
    const request = await prisma.employerRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Request is not in pending status' });
    }
    // Enforce payment method selection for first payment
    let selectedPaymentMethodId = paymentMethodId;
    if (!selectedPaymentMethodId) {
      // If not provided, select the first active payment method as default
      const firstActiveMethod = await prisma.paymentMethod.findFirst({ where: { isActive: true }, orderBy: { id: 'asc' } });
      if (!firstActiveMethod) {
        return res.status(400).json({ error: 'No active payment method found. Please add a payment method before approving requests.' });
      }
      selectedPaymentMethodId = firstActiveMethod.id;
    }
    // Update status to first_payment_required (instead of just approved)
    await prisma.employerRequest.update({
      where: { id: requestId },
      data: {
        status: 'first_payment_required',
        requestApprovedAt: new Date(),
        firstPaymentRequired: true,
        firstPaymentAmount: 5000.00
      }
    });
    // Create first payment record with selected payment method
    await prisma.payment.create({
      data: {
        employerRequestId: requestId,
        amount: 5000.00,
        currency: 'RWF',
        paymentMethodId: selectedPaymentMethodId,
        paymentType: 'first_installment',
        paymentReference: `PAY-${Date.now()}-${requestId}`,
        status: 'pending',
        description: 'First installment for photo access',
        installmentNumber: 1,
        isNonRefundable: true
      }
    });
    // TODO: Trigger employer notification (first payment required)
    res.json({ message: 'Employer request approved and first payment required. Payment method set.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to approve request.' });
  }
};

// Refactor first payment confirmation
exports.confirmFirstPayment = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.body;
    // Confirm first payment
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'first_payment_confirmed', firstPaymentConfirmed: true, firstPaymentConfirmedAt: new Date() }
    });
    // TODO: Trigger admin notification (first payment confirmed)
    // Move to photo access granted
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'photo_access_granted', partialAccessGranted: true, accessGrantedAt: new Date() }
    });
    // TODO: Trigger employer notification (photo access granted)
    res.json({ message: 'First payment confirmed and photo access granted.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to confirm first payment.' });
  }
};

// Refactor full details request
exports.requestFullDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const employerUserId = req.user.id;
    const prisma = await getPrismaClient();
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: { employerAccount: { include: { user: true } } }
    });
    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }
    if (employerRequest.employerAccount.userId !== employerUserId) {
      return res.status(403).json({ error: 'Access denied. This request does not belong to you.' });
    }
    if (employerRequest.status !== 'photo_access_granted') {
      return res.status(400).json({ error: 'You must have photo access before requesting full details.' });
    }
    // Update status to full_details_requested
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'full_details_requested', hiringDecisionNotes: reason ? `Employer request reason: ${reason}` : null }
    });
    // TODO: Trigger admin notification (full details requested)
    // Move to second payment required (admin sets amount in next step)
    res.json({ message: 'Full details request submitted. Awaiting admin review.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH: Only admin can trigger second_payment_required
exports.setSecondPayment = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId, amount } = req.body;
    const adminId = req.user.id;
    // Find the request and ensure correct status
    const request = await prisma.employerRequest.findUnique({ where: { id: parseInt(requestId, 10) } });
    if (!request || !['photo_access_granted', 'full_details_requested'].includes(request.status)) {
      return res.status(400).json({ error: 'Second payment can only be requested from photo_access_granted or full_details_requested status.' });
    }
    // Set second payment required, amount, initiator, and timestamp
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: 'second_payment_required',
        secondPaymentRequired: true,
        secondPaymentAmount: amount,
        secondPaymentInitiator: `admin:${adminId}`,
        secondPaymentInitiatedAt: new Date()
      }
    });
    // TODO: Trigger employer notification (second payment required)
    res.json({ message: 'Second payment required set by admin.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to set second payment.' });
  }
};

// Refactor second payment confirmation
exports.confirmSecondPayment = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.body;
    // Confirm second payment
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'second_payment_confirmed', secondPaymentConfirmed: true, secondPaymentConfirmedAt: new Date() }
    });
    // TODO: Trigger admin notification (second payment confirmed)
    // Move to full access granted
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'full_access_granted', fullAccessGranted: true, accessGrantedAt: new Date() }
    });
    // TODO: Trigger employer notification (full access granted)
    res.json({ message: 'Second payment confirmed and full access granted.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to confirm second payment.' });
  }
};

// Refactor process exit (employer stops after photo access)
exports.exitAfterPhotoAccess = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.body;
    // Only allow if status is photo_access_granted
    const request = await prisma.employerRequest.findUnique({ where: { id: parseInt(requestId, 10) } });
    if (!request || request.status !== 'photo_access_granted') {
      return res.status(400).json({ error: 'Request must be in photo_access_granted status' });
    }
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'process_complete', isCompleted: true, completedAt: new Date() }
    });
    // TODO: Trigger admin notification (process exited after photo access)
    res.json({ message: 'Process exited after photo access.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to exit process.' });
  }
};

// Refactor cancellation
exports.cancelRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.body;
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: { status: 'cancelled', isActive: false, deactivatedAt: new Date() }
    });
    // TODO: Trigger admin and employer notification (request cancelled)
    res.json({ message: 'Request cancelled.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to cancel request.' });
  }
};

// Admin: Update request status
exports.updateRequestStatus = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const requestId = parseInt(req.params.id, 10);
    const { status, priority, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required.' });
    }

    // Validate status
    const validStatuses = ['pending', 'in_progress', 'approved', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be one of: pending, in_progress, approved, completed, cancelled' });
    }

    // Validate priority if provided
    if (priority) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ error: 'Invalid priority. Must be one of: low, normal, high, urgent' });
      }
    }

    // Check if request exists
    const request = await prisma.employerRequest.findUnique({
      where: { id: requestId },
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                contactNumber: true
              }
            }
          }
        },
        employerAccount: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Prepare update data
    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (priority) {
      updateData.priority = priority;
    }

    // Update request
    const updatedRequest = await prisma.employerRequest.update({
      where: { id: requestId },
      data: updateData,
      include: {
        selectedUser: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                contactNumber: true
              }
            }
          }
        }
      }
    });

    // Get employer email from the related user account
    const employerEmail = request.employerAccount?.user?.email;
    const employerName = request.employerAccount?.user?.name || 'Employer';

    // Create system message for status change
    if (adminNotes) {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: employerEmail,
          content: `Status updated to ${status}. ${adminNotes}`,
          messageType: 'system'
        }
      });
    } else {
      await prisma.message.create({
        data: {
          employerRequestId: requestId,
          fromAdmin: true,
          employerEmail: employerEmail,
          content: `Status updated to ${status} by admin.`,
          messageType: 'system'
        }
      });
    }

    // Send email notification for status changes (except for pending)
    // Also send email if admin notes are provided, even if status hasn't changed
    if ((status !== 'pending' && status !== request.status) || adminNotes) {
      if (employerEmail) {
        try {
          console.log(`📧 Sending status update email to: ${employerEmail}, Status: ${status}, Previous: ${request.status}, Has Notes: ${adminNotes ? 'Yes' : 'No'}`);
          await sendStatusUpdateNotification(
            employerEmail,
            employerName,
            status,
            adminNotes,
            {
              id: request.id,
              message: request.message,
              companyName: request.employerAccount?.companyName,
              phoneNumber: request.employerAccount?.phoneNumber
            }
          );
          console.log(`✅ Status update email sent successfully to: ${employerEmail}`);
        } catch (emailError) {
          console.error('❌ Failed to send status update notification:', emailError);
          console.error('❌ Error details:', {
            message: emailError.message,
            code: emailError.code,
            command: emailError.command
          });
          // Continue even if email fails
        }
      } else {
        console.log(`⚠️ Cannot send email notification - No employer email found for request ${requestId}`);
      }
    } else {
      console.log(`ℹ️ Skipping email notification - Status: ${status}, Previous: ${request.status}, No Notes`);
    }

    res.json({
      message: 'Request status updated successfully',
      request: updatedRequest
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update request status.' });
  }
};

// Get employer dashboard data
exports.getEmployerDashboard = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const employerId = req.user.id;

    // Get employer account details
    const employerAccount = await prisma.employerAccount.findFirst({
      where: { userId: employerId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
          }
        }
      }
    });

    if (!employerAccount) {
      return res.status(404).json({ error: 'Employer account not found' });
    }

    // Get all requests for this employer
    const requests = await prisma.employerRequest.findMany({
      where: { employerAccountId: employerAccount.id },
      include: {
        requestedCandidate: {
          include: {
            profile: {
              include: {
                jobCategory: {
                  select: {
                    id: true,
                    name_en: true,
                    name_rw: true
                  }
                }
              }
            }
          }
        },
        selectedUser: {
          include: {
            profile: {
              include: {
                jobCategory: {
                  select: {
                    id: true,
                    name_en: true,
                    name_rw: true
                  }
                }
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest message
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Get latest payment
          include: {
            paymentMethod: {
              select: {
                id: true,
                name: true,
                type: true,
                accountName: true,
                accountNumber: true,
                bankName: true
              }
            }
          }
        },
        requestProgress: {
          orderBy: { createdAt: 'desc' },
          take: 1 // Get latest progress
        },
        _count: {
          select: {
            messages: true,
            payments: true,
            requestProgress: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Get unread message count
    const unreadCount = await prisma.message.count({
      where: {
        fromAdmin: true,
        isRead: false,
        employerRequest: {
          employerAccountId: employerAccount.id
        }
      }
    });

    // Calculate statistics
    const stats = {
      totalRequests: requests.length,
      pendingRequests: requests.filter(r => r.status === 'pending').length,
      paymentRequired: requests.filter(r => r.status === 'payment_required').length,
      approvedRequests: requests.filter(r => r.status === 'approved').length,
      completedRequests: requests.filter(r => r.status === 'completed').length,
      totalMessages: requests.reduce((sum, r) => sum + r._count.messages, 0),
      unreadMessages: unreadCount,
      totalPayments: requests.reduce((sum, r) => sum + r._count.payments, 0)
    };

    // Process requests using proper anonymization utility
    const processedRequests = requests.map(request => {
      const requestData = {
        id: request.id,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        message: request.message,
        paymentRequired: request.paymentRequired,
        paymentAmount: request.paymentAmount,
        paymentCurrency: request.paymentCurrency,
        paymentDescription: request.paymentDescription,
        paymentDueDate: request.paymentDueDate,
        contactAccessGranted: request.contactAccessGranted,
        imageAccessGranted: request.imageAccessGranted,
        accessGrantedAt: request.accessGrantedAt,
        messageCount: request._count.messages,
        paymentCount: request._count.payments,
        progressCount: request._count.requestProgress,
        latestMessage: request.messages[0] || null,
        latestPayment: request.payments[0] || null,
        latestProgress: request.requestProgress[0] || null
      };

      // Add candidate information using proper anonymization utility
      if (request.requestedCandidate) {
        const anonymizedCandidate = getAnonymizedJobSeekerData(request.requestedCandidate, request);
        requestData.candidate = {
          id: anonymizedCandidate.id,
          email: anonymizedCandidate.email,
          name: `${anonymizedCandidate.profile.firstName} ${anonymizedCandidate.profile.lastName}`,
          role: anonymizedCandidate.role,
          createdAt: anonymizedCandidate.createdAt,
          updatedAt: anonymizedCandidate.updatedAt,
          isAvailableForMatching: anonymizedCandidate.isAvailableForMatching,
          matchedAt: anonymizedCandidate.matchedAt,
          // Profile data
          profileId: anonymizedCandidate.profile.id,
          firstName: anonymizedCandidate.profile.firstName,
          lastName: anonymizedCandidate.profile.lastName,
          skills: anonymizedCandidate.profile.skills || 'Not specified',
          experience: anonymizedCandidate.profile.experience || 'Not specified',
          experienceLevel: anonymizedCandidate.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedCandidate.profile.educationLevel || 'Not specified',
          location: anonymizedCandidate.profile.location || 'Not specified',
          city: anonymizedCandidate.profile.city || 'Not specified',
          country: anonymizedCandidate.profile.country || 'Not specified',
          gender: anonymizedCandidate.profile.gender || 'Not specified',
          monthlyRate: anonymizedCandidate.profile.monthlyRate || 'Not specified',
          availability: anonymizedCandidate.profile.availability || 'Not specified',
          languages: anonymizedCandidate.profile.languages || 'Not specified',
          certifications: anonymizedCandidate.profile.certifications || 'Not specified',
          description: anonymizedCandidate.profile.description || 'Not specified',
          photo: anonymizedCandidate.profile.photo,
          contactNumber: anonymizedCandidate.profile.contactNumber,
          idNumber: anonymizedCandidate.profile.idNumber,
          references: anonymizedCandidate.profile.references,
          dateOfBirth: anonymizedCandidate.profile.dateOfBirth,
          maritalStatus: anonymizedCandidate.profile.maritalStatus,
          approvalStatus: anonymizedCandidate.profile.approvalStatus,
          isActive: anonymizedCandidate.profile.isActive,
          approvedAt: anonymizedCandidate.profile.approvedAt,
          jobCategory: anonymizedCandidate.profile.jobCategory,
          accessLevel: anonymizedCandidate.accessLevel,
          accessGranted: anonymizedCandidate.accessGranted
        };
      }

      // Add selected user information if different from requested candidate
      if (request.selectedUser && request.selectedUser.id !== request.requestedCandidate?.id) {
        const anonymizedSelectedUser = getAnonymizedJobSeekerData(request.selectedUser, request);
        requestData.selectedUser = {
          id: anonymizedSelectedUser.id,
          name: `${anonymizedSelectedUser.profile.firstName} ${anonymizedSelectedUser.profile.lastName}`,
          skills: anonymizedSelectedUser.profile.skills || 'Not specified',
          experience: anonymizedSelectedUser.profile.experience || 'Not specified',
          experienceLevel: anonymizedSelectedUser.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedSelectedUser.profile.educationLevel || 'Not specified',
          location: anonymizedSelectedUser.profile.location || 'Not specified',
          city: anonymizedSelectedUser.profile.city || 'Not specified',
          country: anonymizedSelectedUser.profile.country || 'Not specified',
          gender: anonymizedSelectedUser.profile.gender || 'Not specified',
          monthlyRate: anonymizedSelectedUser.profile.monthlyRate || 'Not specified',
          availability: anonymizedSelectedUser.profile.availability || 'Not specified',
          languages: anonymizedSelectedUser.profile.languages || 'Not specified',
          certifications: anonymizedSelectedUser.profile.certifications || 'Not specified',
          description: anonymizedSelectedUser.profile.description || 'Not specified',
          photo: anonymizedSelectedUser.profile.photo,
          contactNumber: anonymizedSelectedUser.profile.contactNumber,
          accessLevel: anonymizedSelectedUser.accessLevel,
          accessGranted: anonymizedSelectedUser.accessGranted
        };
      }

      return requestData;
    });

    res.json({
      employer: {
        id: employerAccount.id,
        email: employerAccount.user.email,
        name: employerAccount.user.name,
        phoneNumber: employerAccount.phoneNumber,
        companyName: employerAccount.companyName,
        createdAt: employerAccount.user.createdAt
      },
      stats,
      requests: processedRequests
    });

  } catch (error) {
    console.error('Error getting employer dashboard:', error);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
};

// Get all employer requests (admin only)
exports.getAllEmployerRequests = async (req, res) => {
  try {
    const prisma = await getPrismaClient();

    // Get query parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder || 'desc';
    const status = req.query.status || 'all';

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause = {};
    if (status !== 'all') {
      whereClause.status = status;
    }

    // Get total count
    const totalCount = await prisma.employerRequest.count({
      where: whereClause
    });

    // Get requests with pagination and sorting
    const requests = await prisma.employerRequest.findMany({
      where: whereClause,
      include: {
        employerAccount: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                createdAt: true
              }
            }
          }
        },
        requestedCandidate: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                educationLevel: true,
                location: true,
                city: true,
                country: true,
                gender: true,
                monthlyRate: true,
                availability: true,
                languages: true,
                certifications: true,
                description: true,
                photo: true,
                contactNumber: true
              }
            }
          }
        },
        selectedUser: {
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                experienceLevel: true,
                educationLevel: true,
                location: true,
                city: true,
                country: true,
                gender: true,
                monthlyRate: true,
                availability: true,
                languages: true,
                certifications: true,
                description: true,
                photo: true,
                contactNumber: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        payments: {
          include: {
            paymentMethod: true
          },
          orderBy: { createdAt: 'desc' }
        },
        requestProgress: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            messages: true,
            payments: true,
            requestProgress: true
          }
        }
      },
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: offset,
      take: limit
    });

    // Process requests using proper anonymization utility
    const processedRequests = requests.map(request => {
      const requestData = {
        id: request.id,
        status: request.status,
        priority: request.priority,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
        message: request.message,
        paymentRequired: request.paymentRequired,
        paymentAmount: request.paymentAmount,
        paymentCurrency: request.paymentCurrency,
        paymentDescription: request.paymentDescription,
        paymentDueDate: request.paymentDueDate,
        secondPaymentRequired: request.secondPaymentRequired,
        secondPaymentAmount: request.secondPaymentAmount,
        secondPaymentInitiator: request.secondPaymentInitiator,
        contactAccessGranted: request.contactAccessGranted,
        imageAccessGranted: request.imageAccessGranted,
        accessGrantedAt: request.accessGrantedAt,
        messageCount: request._count.messages,
        paymentCount: request._count.payments,
        progressCount: request._count.requestProgress,
        latestMessage: request.messages[0] || null,
        latestPayment: request.payments[0] || null,
        latestProgress: request.requestProgress[0] || null,
        // Add specific payment installments (get the latest pending payment for each type)
        firstInstallmentPayment: request.payments
          .filter(p => p.paymentType === 'first_installment' && p.status === 'pending')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null,
        secondInstallmentPayment: request.payments
          .filter(p => p.paymentType === 'second_installment' && p.status === 'pending')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null,
        // Add current payment for UI (based on status) - get the LATEST pending payment
        currentPayment: request.status === 'second_payment_required'
          ? (request.payments
            .filter(p => p.paymentType === 'second_installment' && p.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null)
          : (request.payments
            .filter(p => p.paymentType === 'first_installment' && p.status === 'pending')
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null),
        employer: {
          id: request.employerAccount.id,
          email: request.employerAccount.user.email,
          name: request.employerAccount.user.name,
          companyName: request.employerAccount.companyName
        }
      };

      // Add candidate information using proper anonymization utility
      if (request.requestedCandidate) {
        const anonymizedCandidate = getAnonymizedJobSeekerData(request.requestedCandidate, request);
        requestData.candidate = {
          id: anonymizedCandidate.id,
          name: `${anonymizedCandidate.profile.firstName} ${anonymizedCandidate.profile.lastName}`,
          skills: anonymizedCandidate.profile.skills || 'Not specified',
          experience: anonymizedCandidate.profile.experience || 'Not specified',
          experienceLevel: anonymizedCandidate.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedCandidate.profile.educationLevel || 'Not specified',
          location: anonymizedCandidate.profile.location || 'Not specified',
          city: anonymizedCandidate.profile.city || 'Not specified',
          country: anonymizedCandidate.profile.country || 'Not specified',
          gender: anonymizedCandidate.profile.gender || 'Not specified',
          monthlyRate: anonymizedCandidate.profile.monthlyRate || 'Not specified',
          availability: anonymizedCandidate.profile.availability || 'Not specified',
          languages: anonymizedCandidate.profile.languages || 'Not specified',
          certifications: anonymizedCandidate.profile.certifications || 'Not specified',
          description: anonymizedCandidate.profile.description || 'Not specified',
          photo: anonymizedCandidate.profile.photo,
          contactNumber: anonymizedCandidate.profile.contactNumber,
          accessLevel: anonymizedCandidate.accessLevel,
          accessGranted: anonymizedCandidate.accessGranted
        };
      }

      // Add selected user information if different from requested candidate
      if (request.selectedUser && request.selectedUser.id !== request.requestedCandidate?.id) {
        const anonymizedSelectedUser = getAnonymizedJobSeekerData(request.selectedUser, request);
        requestData.selectedUser = {
          id: anonymizedSelectedUser.id,
          name: `${anonymizedSelectedUser.profile.firstName} ${anonymizedSelectedUser.profile.lastName}`,
          skills: anonymizedSelectedUser.profile.skills || 'Not specified',
          experience: anonymizedSelectedUser.profile.experience || 'Not specified',
          experienceLevel: anonymizedSelectedUser.profile.experienceLevel || 'Not specified',
          educationLevel: anonymizedSelectedUser.profile.educationLevel || 'Not specified',
          location: anonymizedSelectedUser.profile.location || 'Not specified',
          city: anonymizedSelectedUser.profile.city || 'Not specified',
          country: anonymizedSelectedUser.profile.country || 'Not specified',
          gender: anonymizedSelectedUser.profile.gender || 'Not specified',
          monthlyRate: anonymizedSelectedUser.profile.monthlyRate || 'Not specified',
          availability: anonymizedSelectedUser.profile.availability || 'Not specified',
          languages: anonymizedSelectedUser.profile.languages || 'Not specified',
          certifications: anonymizedSelectedUser.profile.certifications || 'Not specified',
          description: anonymizedSelectedUser.profile.description || 'Not specified',
          photo: anonymizedSelectedUser.profile.photo,
          contactNumber: anonymizedSelectedUser.profile.contactNumber,
          accessLevel: anonymizedSelectedUser.accessLevel,
          accessGranted: anonymizedSelectedUser.accessGranted
        };
      }

      return requestData;
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      requests: processedRequests,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPrevPage,
        limit
      }
    });

  } catch (error) {
    console.error('Error getting all employer requests:', error);
    res.status(500).json({ error: 'Failed to get employer requests' });
  }
};

// ===== NEW WORKFLOW FUNCTIONS =====

/**
 * Mark hiring decision
 */
exports.markHiringDecision = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { decision, notes } = req.body; // decision: 'hired' | 'not_hired'
    const employerUserId = req.user.id;
    const prisma = await getPrismaClient();
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: { include: { user: true } }
      }
    });
    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }
    if (employerRequest.employerAccount.userId !== employerUserId) {
      return res.status(403).json({ error: 'Access denied. This request does not belong to you.' });
    }
    if (employerRequest.status !== 'full_access_granted') {
      return res.status(400).json({ error: 'You must have full access before making hiring decision.' });
    }
    // Determine new status and employer visibility
    let newStatus = 'hiring_decision_not_made';
    let employerVisible = false;
    if (decision === 'hired') {
      newStatus = 'hired';
      employerVisible = true;
    } else if (decision === 'not_hired') {
      newStatus = 'available';
      employerVisible = false;
    }
    await prisma.employerRequest.update({
      where: { id: parseInt(requestId, 10) },
      data: {
        status: newStatus,
        hiringDecision: decision,
        hiringDecisionMadeBy: employerUserId,
        hiringDecisionMadeAt: new Date(),
        hiringDecisionNotes: notes,
        employerVisibleToCandidate: employerVisible
      }
    });
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(requestId, 10),
        stage: newStatus,
        status: 'completed',
        description: `Employer marked candidate as ${decision}${notes ? `: ${notes}` : ''}`,
        completedAt: new Date()
      }
    });
    // TODO: Trigger candidate notification (hired or not_hired)
    // TODO: Trigger admin notification for hiring decision
    res.json({ message: 'Hiring decision recorded successfully' });
  } catch (error) {
    console.error('Error marking hiring decision:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get photo access for candidate
 */
exports.getPhotoAccess = async (req, res) => {
  try {
    const { requestId } = req.params;
    const employerUserId = req.user.id;

    const prisma = await getPrismaClient();

    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        },
        requestedCandidate: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    // Check if the request belongs to the authenticated employer
    if (employerRequest.employerAccount.userId !== employerUserId) {
      return res.status(403).json({ error: 'Access denied. This request does not belong to you.' });
    }

    // Check if employer has photo access
    if (!employerRequest.partialAccessGranted) {
      return res.status(403).json({ error: 'You do not have photo access for this candidate.' });
    }

    // Return photo access data
    const photoData = {
      candidateId: employerRequest.requestedCandidate.id,
      candidateName: employerRequest.requestedCandidate.name,
      candidatePhoto: employerRequest.requestedCandidate.profile?.photo || null,
      // Add other photo-level information
      basicInfo: {
        age: employerRequest.requestedCandidate.profile?.age || null,
        location: employerRequest.requestedCandidate.profile?.location || null,
        experience: employerRequest.requestedCandidate.profile?.experience || null
      }
    };

    res.json(photoData);
  } catch (error) {
    console.error('Error getting photo access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get full details for candidate
 */
exports.getFullDetails = async (req, res) => {
  try {
    const { requestId } = req.params;
    const employerUserId = req.user.id;

    const prisma = await getPrismaClient();

    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        },
        requestedCandidate: {
          include: {
            profile: true
          }
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found' });
    }

    // Check if the request belongs to the authenticated employer
    if (employerRequest.employerAccount.userId !== employerUserId) {
      return res.status(403).json({ error: 'Access denied. This request does not belong to you.' });
    }

    // Check if employer has full access
    if (!employerRequest.fullAccessGranted) {
      return res.status(403).json({ error: 'You do not have full access for this candidate.' });
    }

    // Return full candidate details
    const fullData = {
      candidateId: employerRequest.requestedCandidate.id,
      candidateName: employerRequest.requestedCandidate.name,
      candidateEmail: employerRequest.requestedCandidate.email,
      candidatePhone: employerRequest.requestedCandidate.profile?.phone || null,
      candidatePhoto: employerRequest.requestedCandidate.profile?.photo || null,
      fullProfile: employerRequest.requestedCandidate.profile,
      // Add all other candidate information
      completeInfo: {
        personal: employerRequest.requestedCandidate.profile?.personal || {},
        skills: employerRequest.requestedCandidate.profile?.skills || {},
        experience: employerRequest.requestedCandidate.profile?.experience || {},
        education: employerRequest.requestedCandidate.profile?.education || {},
        certifications: employerRequest.requestedCandidate.profile?.certifications || {}
      }
    };

    res.json(fullData);
  } catch (error) {
    console.error('Error getting full details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Approve/Reject full details request and set second payment
exports.approveFullDetailsRequest = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.params;
    const { action, amount, notes } = req.body; // action: 'approve' | 'reject'
    const adminId = req.user.id;
    const request = await prisma.employerRequest.findUnique({ where: { id: parseInt(requestId, 10) } });
    if (!request || request.status !== 'full_details_requested') {
      return res.status(400).json({ error: 'Request is not in full_details_requested status' });
    }
    if (action === 'approve') {
      // Create second payment using PaymentService
      const PaymentService = require('../services/paymentService');
      await PaymentService.createSecondPayment(parseInt(requestId, 10), amount || 10000.0);

      // Update additional tracking fields
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          secondPaymentApprovedBy: adminId,
          secondPaymentApprovedAt: new Date()
        }
      });
      // TODO: Trigger employer notification (second payment required)
      res.json({ message: 'Full details request approved. Second payment required.' });
    } else if (action === 'reject') {
      // Revert to photo access granted
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'photo_access_granted',
          hiringDecisionNotes: notes ? `Admin rejection reason: ${notes}` : 'Full details request rejected by admin'
        }
      });
      // TODO: Trigger employer notification (full details rejected)
      res.json({ message: 'Full details request rejected. Employer retains photo access only.' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin: Update candidate availability after hiring decision
exports.updateCandidateAvailability = async (req, res) => {
  try {
    const prisma = await getPrismaClient();
    const { requestId } = req.params;
    const { action } = req.body; // action: 'mark_unavailable' | 'keep_available'
    const adminId = req.user.id;
    const request = await prisma.employerRequest.findUnique({
      where: { id: parseInt(requestId, 10) },
      include: { requestedCandidate: true }
    });
    if (!request || request.status !== 'hired') {
      return res.status(400).json({ error: 'Request must be in hired status' });
    }
    if (action === 'mark_unavailable') {
      // Mark candidate as unavailable
      await prisma.user.update({
        where: { id: request.requestedCandidateId },
        data: {
          isAvailableForMatching: false,
          matchedAt: new Date(),
          matchedWithEmployerId: parseInt(requestId, 10)
        }
      });
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'completed',
          isCompleted: true,
          completedAt: new Date(),
          completedBy: adminId,
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: adminId
        }
      });
      // TODO: Trigger candidate notification (marked as hired/unavailable)
      res.json({ message: 'Candidate marked as unavailable and request completed' });
    } else if (action === 'keep_available') {
      // Keep candidate available and deactivate request
      await prisma.employerRequest.update({
        where: { id: parseInt(requestId, 10) },
        data: {
          status: 'completed',
          isCompleted: true,
          completedAt: new Date(),
          completedBy: adminId,
          isActive: false,
          deactivatedAt: new Date(),
          deactivatedBy: adminId
        }
      });
      // TODO: Trigger candidate notification (request completed, still available)
      res.json({ message: 'Request completed. Candidate remains available for other requests.' });
    } else {
      return res.status(400).json({ error: 'Invalid action. Must be "mark_unavailable" or "keep_available"' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}; 