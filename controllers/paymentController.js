const { getPrismaClient } = require('../utils/database');
const { 
  sendPaymentRequestNotification, 
  sendPaymentConfirmationNotification, 
  sendPaymentApprovalNotification 
} = require('../utils/paymentNotifications');
const { getAdminEmail } = require('../utils/adminUtils');
const NotificationService = require('../services/notificationService');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Admin: Request payment from employer
exports.requestPayment = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { 
      employerRequestId, 
      amount, 
      currency = 'RWF', 
      description,
      paymentMethodId,
      paymentType = 'photo_access', // photo_access | full_details
      dueDate 
    } = req.body;

    // Validate required fields
    if (!employerRequestId || !amount) {
      return res.status(400).json({ 
        error: 'Employer request ID and amount are required.' 
      });
    }

    // Check if employer request exists
    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(employerRequestId, 10) }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    // Check if any payment already exists for this request
    const existingPaymentCheck = await prisma.payment.findFirst({
      where: { 
        employerRequestId: parseInt(employerRequestId, 10),
        status: { in: ['pending', 'confirmed'] }
      }
    });

    if (existingPaymentCheck) {
      return res.status(409).json({ 
        error: 'Payment already requested for this employer request.' 
      });
    }

    // Validate payment method
    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required.' });
    }

    // Check if payment method exists and is active
    const paymentMethod = await prisma.paymentMethod.findUnique({
      where: { id: parseInt(paymentMethodId, 10) }
    });

    if (!paymentMethod || !paymentMethod.isActive) {
      return res.status(400).json({ error: 'Invalid or inactive payment method.' });
    }

    // Validate payment type
    const validPaymentTypes = ['photo_access', 'full_details'];
    if (!validPaymentTypes.includes(paymentType)) {
      return res.status(400).json({ error: 'Invalid payment type. Must be photo_access or full_details.' });
    }

    // Check if payment of this type already exists for this request
    const existingPayment = await prisma.payment.findFirst({
      where: { 
        employerRequestId: parseInt(employerRequestId, 10),
        paymentType,
        status: { in: ['pending', 'confirmed'] }
      }
    });

    if (existingPayment) {
      return res.status(409).json({ 
        error: `${paymentType === 'photo_access' ? 'Photo access' : 'Full details'} payment already requested for this employer request.` 
      });
    }

    // Create payment request
    const payment = await prisma.payment.create({
      data: {
        employerRequestId: parseInt(employerRequestId, 10),
        amount: parseFloat(amount),
        currency,
        paymentMethodId: parseInt(paymentMethodId, 10),
        paymentType,
        paymentReference: `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        description: description || `${paymentType === 'photo_access' ? 'Photo access' : 'Full details'} payment for job seeker request`,
        status: 'pending'
      }
    });

    // Update employer request status
    await prisma.employerRequest.update({
      where: { id: parseInt(employerRequestId, 10) },
      data: {
        status: 'payment_required',
        paymentRequired: true,
        paymentAmount: parseFloat(amount),
        paymentCurrency: currency,
        paymentDescription: description,
        paymentDueDate: dueDate ? new Date(dueDate) : null
      }
    });

    // Get employer details for email notification
    const employerDetails = await prisma.employerRequest.findUnique({
      where: { id: parseInt(employerRequestId, 10) },
      include: {
        employerAccount: {
          include: { user: true }
        }
      }
    });

    // Send email notification to employer
    try {
      await sendPaymentRequestNotification(
        employerDetails.employerAccount.user.email,
        employerDetails.employerAccount.user.name,
        {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          paymentType: payment.paymentType,
          paymentMethod: {
            name: paymentMethod.name,
            accountName: paymentMethod.accountName,
            accountNumber: paymentMethod.accountNumber,
            bankName: paymentMethod.bankName
          }
        }
      );
    } catch (emailError) {
      console.error('Failed to send payment request notification:', emailError);
      // Continue even if email fails
    }

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: parseInt(employerRequestId, 10),
        stage: 'payment_requested',
        status: 'completed',
        description: `${paymentType === 'photo_access' ? 'Photo access' : 'Full details'} payment of ${amount} ${currency} requested`,
        completedAt: new Date(),
        completedBy: req.user.id
      }
    });

    res.status(201).json({
      message: 'Payment request created successfully',
      payment: {
        ...payment,
        paymentMethod: {
          name: paymentMethod.name,
          accountName: paymentMethod.accountName,
          accountNumber: paymentMethod.accountNumber,
          bankName: paymentMethod.bankName
        }
      },
      nextSteps: [
        'Employer will receive payment instructions',
        'Payment confirmation required',
        'Admin approval needed after confirmation'
      ]
    });

  } catch (err) {
    console.error('Payment request error:', err);
    res.status(500).json({ error: err.message || 'Failed to create payment request.' });
  }
};

// Employer: Confirm payment made
exports.confirmPayment = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { 
      paymentId, 
      confirmationName, 
      confirmationPhone, 
      paymentReference 
    } = req.body;

    // Validate required fields
    if (!paymentId || !confirmationName || !confirmationPhone) {
      return res.status(400).json({ 
        error: 'Payment ID, confirmation name, and phone are required.' 
      });
    }

    // Find payment
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId, 10) },
      include: { employerRequest: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    // Check if payment is already confirmed
    if (payment.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Payment is already confirmed or processed.' 
      });
    }

    // Update payment with confirmation details
    const updatedPayment = await prisma.payment.update({
      where: { id: parseInt(paymentId, 10) },
      data: {
        status: 'confirmed',
        confirmationName,
        confirmationPhone,
        confirmationDate: new Date(),
        paymentReference: paymentReference || `CONF_${Date.now()}`
      }
    });

    // Update employer request status
    await prisma.employerRequest.update({
      where: { id: payment.employerRequestId },
      data: {
        status: 'payment_confirmed'
      }
    });

    // Create progress tracking
    await prisma.requestProgress.create({
      data: {
        employerRequestId: payment.employerRequestId,
        stage: 'payment_confirmed',
        status: 'completed',
        description: `Payment confirmed by ${confirmationName} (${confirmationPhone})`,
        completedAt: new Date()
      }
    });

    // Send email notifications (don't let email failures affect the main response)
    try {
      // Get full payment details with employer info for email
      const fullPayment = await prisma.payment.findUnique({
        where: { id: parseInt(paymentId, 10) },
        include: {
          employerRequest: {
            include: {
              employerAccount: {
                include: { user: true }
              }
            }
          }
        }
      });

      // Email to Admin - Payment confirmation received
      await NotificationService.sendAdminNotification({
        type: 'payment_confirmed',
        title: 'Payment Confirmation Received',
        message: `Employer ${fullPayment.employerRequest.employerAccount.user.name} has confirmed payment for request #${payment.employerRequestId}. Amount: ${fullPayment.amount} ${fullPayment.currency}`,
        employerRequestId: payment.employerRequestId
      });

      // Email to Employer - Confirmation received
      if (fullPayment.employerRequest.employerAccount?.user?.email) {
        await NotificationService.sendEmail({
          to: fullPayment.employerRequest.employerAccount.user.email,
          subject: 'Payment Confirmation Received - Job Portal',
          html: `
            <h2>Payment Confirmation Received</h2>
            <p>Dear ${fullPayment.employerRequest.employerAccount.user.name},</p>
            <p>Your payment confirmation has been received and is being reviewed by our admin team.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3>Payment Details:</h3>
              <p><strong>Amount:</strong> ${fullPayment.amount} ${fullPayment.currency}</p>
              <p><strong>Payment Reference:</strong> ${paymentReference || 'Not provided'}</p>
              <p><strong>Confirmed by:</strong> ${confirmationName} (${confirmationPhone})</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Admin will review your payment confirmation</li>
              <li>Contact/image access will be granted after approval</li>
              <li>You will be notified when access is granted</li>
            </ul>
            <p>Thank you for using our job portal service.</p>
          `
        });
      }
    } catch (emailError) {
      console.error('Failed to send email notifications:', emailError);
      // Don't throw - email failure shouldn't affect the main operation
    }

    res.json({
      message: 'Payment confirmation received successfully',
      payment: updatedPayment,
      nextSteps: [
        'Admin will review payment confirmation',
        'Contact/image access will be granted after approval',
        'You will be notified when access is granted'
      ]
    });

  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ error: err.message || 'Failed to confirm payment.' });
  }
};

// Admin: Approve payment and grant access
exports.approvePayment = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { paymentId, action, notes } = req.body;

    // Validate required fields
    if (!paymentId || !action) {
      return res.status(400).json({ 
        error: 'Payment ID and action are required.' 
      });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        error: 'Action must be either "approve" or "reject".' 
      });
    }

    // Find payment with employer request
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(paymentId, 10) },
      include: { 
        employerRequest: {
          include: {
            requestedCandidate: {
              include: { profile: true }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    // Check if payment is confirmed
    if (payment.status !== 'confirmed') {
      return res.status(400).json({ 
        error: 'Payment must be confirmed before approval.' 
      });
    }

    // Create payment approval record
    await prisma.paymentApproval.create({
      data: {
        paymentId: parseInt(paymentId, 10),
        adminId: req.user.id,
        action,
        notes
      }
    });

    if (action === 'approve') {
      // Update payment status
      await prisma.payment.update({
        where: { id: parseInt(paymentId, 10) },
        data: { status: 'approved' }
      });

      // Grant access to employer request
      await prisma.employerRequest.update({
        where: { id: payment.employerRequestId },
        data: {
          status: 'approved',
          contactAccessGranted: true,
          imageAccessGranted: true,
          accessGrantedAt: new Date(),
          accessGrantedBy: req.user.id
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: 'contact_shared',
          status: 'completed',
          description: 'Payment approved - Contact and image access granted',
          completedAt: new Date(),
          completedBy: req.user.id
        }
      });

      res.json({
        message: 'Payment approved and access granted successfully',
        accessGranted: {
          contactAccess: true,
          imageAccess: true,
          jobSeekerName: `${payment.employerRequest.requestedCandidate?.profile?.firstName} ${payment.employerRequest.requestedCandidate?.profile?.lastName}`,
          contactNumber: payment.employerRequest.requestedCandidate?.profile?.contactNumber,
          photo: payment.employerRequest.requestedCandidate?.profile?.photo
        }
      });

    } else {
      // Reject payment
      await prisma.payment.update({
        where: { id: parseInt(paymentId, 10) },
        data: { status: 'rejected' }
      });

      // Update employer request status
      await prisma.employerRequest.update({
        where: { id: payment.employerRequestId },
        data: {
          status: 'payment_rejected'
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: 'payment_rejected',
          status: 'completed',
          description: `Payment rejected by admin: ${notes || 'No reason provided'}`,
          completedAt: new Date(),
          completedBy: req.user.id
        }
      });

      res.json({
        message: 'Payment rejected successfully',
        reason: notes || 'No reason provided'
      });
    }

  } catch (err) {
    console.error('Payment approval error:', err);
    res.status(500).json({ error: err.message || 'Failed to process payment approval.' });
  }
};

// Get payment details for employer
exports.getPaymentDetails = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { employerRequestId } = req.params;

    const payment = await prisma.payment.findFirst({
      where: { 
        employerRequestId: parseInt(employerRequestId, 10) 
      },
      include: {
        employerRequest: {
          include: {
            requestedCandidate: {
              include: { profile: true }
            }
          }
        },
        approvals: {
          include: {
            admin: {
              select: { email: true }
            }
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found for this request.' });
    }

    res.json({
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        description: payment.description,
        createdAt: payment.createdAt,
        confirmationName: payment.confirmationName,
        confirmationPhone: payment.confirmationPhone,
        confirmationDate: payment.confirmationDate,
        adminNotes: payment.adminNotes
      },
      employerRequest: {
        id: payment.employerRequest.id,
        status: payment.employerRequest.status,
        paymentRequired: payment.employerRequest.paymentRequired,
        paymentAmount: payment.employerRequest.paymentAmount,
        paymentCurrency: payment.employerRequest.paymentCurrency,
        paymentDescription: payment.employerRequest.paymentDescription,
        paymentDueDate: payment.employerRequest.paymentDueDate,
        contactAccessGranted: payment.employerRequest.contactAccessGranted,
        imageAccessGranted: payment.employerRequest.imageAccessGranted
      },
      jobSeeker: payment.employerRequest.requestedCandidate ? {
        name: `${payment.employerRequest.requestedCandidate.profile?.firstName} ${payment.employerRequest.requestedCandidate.profile?.lastName}`,
        skills: payment.employerRequest.requestedCandidate.profile?.skills,
        experience: payment.employerRequest.requestedCandidate.profile?.experience,
        location: payment.employerRequest.requestedCandidate.profile?.location,
        city: payment.employerRequest.requestedCandidate.profile?.city,
        country: payment.employerRequest.requestedCandidate.profile?.country,
        // Only show contact and photo if access is granted
        contactNumber: payment.employerRequest.contactAccessGranted ? 
          payment.employerRequest.requestedCandidate.profile?.contactNumber : null,
        photo: payment.employerRequest.imageAccessGranted ? 
          payment.employerRequest.requestedCandidate.profile?.photo : null
      } : null,
      adminApprovals: payment.approvals.map(approval => ({
        action: approval.action,
        notes: approval.notes,
        adminEmail: approval.admin.email,
        createdAt: approval.createdAt
      }))
    });

  } catch (err) {
    console.error('Get payment details error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payment details.' });
  }
};

// Get all payments for admin
exports.getAllPayments = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status; // Filter by payment status
    const skip = (page - 1) * limit;

    const whereClause = {};
    if (status) {
      whereClause.status = status;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          employerRequest: {
            include: {
              requestedCandidate: {
                include: { profile: true }
              }
            }
          },
          approvals: {
            include: {
              admin: {
                select: { email: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.payment.count({ where: whereClause })
    ]);

    res.json({
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        employerName: payment.employerName,
        employerEmail: payment.employerEmail,
        employerPhone: payment.employerPhone,
        confirmationName: payment.confirmationName,
        confirmationPhone: payment.confirmationPhone,
        confirmationDate: payment.confirmationDate,
        createdAt: payment.createdAt,
        employerRequest: {
          id: payment.employerRequest.id,
          status: payment.employerRequest.status,
          requestedCandidate: payment.employerRequest.requestedCandidate ? {
            name: `${payment.employerRequest.requestedCandidate.profile?.firstName} ${payment.employerRequest.requestedCandidate.profile?.lastName}`,
            skills: payment.employerRequest.requestedCandidate.profile?.skills
          } : null
        },
        adminApprovals: payment.approvals.map(approval => ({
          action: approval.action,
          notes: approval.notes,
          adminEmail: approval.admin.email,
          createdAt: approval.createdAt
        }))
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('Get all payments error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch payments.' });
  }
};

// Get request progress for employer
exports.getRequestProgress = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { employerRequestId } = req.params;

    const progress = await prisma.requestProgress.findMany({
      where: { 
        employerRequestId: parseInt(employerRequestId, 10) 
      },
      orderBy: { createdAt: 'asc' }
    });

    const employerRequest = await prisma.employerRequest.findUnique({
      where: { id: parseInt(employerRequestId, 10) },
      include: {
        requestedCandidate: {
          include: { profile: true }
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!employerRequest) {
      return res.status(404).json({ error: 'Employer request not found.' });
    }

    res.json({
      requestId: employerRequest.id,
      status: employerRequest.status,
      progress: progress.map(step => ({
        stage: step.stage,
        status: step.status,
        description: step.description,
        adminNotes: step.adminNotes,
        completedAt: step.completedAt,
        createdAt: step.createdAt
      })),
      currentStage: progress[progress.length - 1]?.stage || 'request_received',
      paymentInfo: employerRequest.payments[0] ? {
        amount: employerRequest.payments[0].amount,
        currency: employerRequest.payments[0].currency,
        status: employerRequest.payments[0].status,
        paymentMethod: employerRequest.payments[0].paymentMethod
      } : null,
      accessStatus: {
        contactAccess: employerRequest.contactAccessGranted,
        imageAccess: employerRequest.imageAccessGranted,
        accessGrantedAt: employerRequest.accessGrantedAt
      }
    });

  } catch (err) {
    console.error('Get request progress error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch request progress.' });
  }
};
