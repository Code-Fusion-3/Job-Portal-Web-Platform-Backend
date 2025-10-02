const { getPrismaClient } = require('../utils/database');
const NotificationService = require('../services/notificationService');
let prisma = null;

// Initialize Prisma client
const initPrisma = async () => {
  if (!prisma) {
    prisma = await getPrismaClient();
  }
  return prisma;
};

// Employer: Confirm payment with details
exports.confirmPayment = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { 
      paymentId, 
      confirmationName, 
      confirmationPhone, 
      paymentReference,
      transferAmount,
      transferDate,
      notes 
    } = req.body;

    if (!paymentId || !confirmationName || !confirmationPhone) {
      return res.status(400).json({ 
        error: 'Payment ID, confirmation name, and phone are required.' 
      });
    }

    const payment = await prisma.payment.findUnique({
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

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

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
        paymentReference: paymentReference || `CONF_${Date.now()}`,
        adminNotes: notes ? `Employer notes: ${notes}` : null
      }
    });

    // Determine the correct status based on payment type
    const newStatus = payment.paymentType === 'first_installment' || payment.paymentType === 'photo_access'
      ? 'first_payment_confirmed'
      : payment.paymentType === 'second_installment' || payment.paymentType === 'full_details'
        ? 'second_payment_confirmed'
        : 'payment_confirmed'; // fallback for legacy payments

    // Update employer request status with appropriate payment confirmation status
    const updateData = { status: newStatus };
    
    // Update payment-specific fields based on installment type
    if (payment.paymentType === 'first_installment' || payment.paymentType === 'photo_access') {
      updateData.firstPaymentConfirmed = true;
      updateData.firstPaymentConfirmedAt = new Date();
    } else if (payment.paymentType === 'second_installment' || payment.paymentType === 'full_details') {
      updateData.secondPaymentConfirmed = true;
      updateData.secondPaymentConfirmedAt = new Date();
    }

    await prisma.employerRequest.update({
      where: { id: payment.employerRequestId },
      data: updateData
    });

    // Create progress tracking with correct stage
    const stage = payment.paymentType === 'first_installment' || payment.paymentType === 'photo_access'
      ? 'first_payment_confirmed'
      : payment.paymentType === 'second_installment' || payment.paymentType === 'full_details'
        ? 'second_payment_confirmed'
        : 'payment_confirmed';

    const isFirstPayment = payment.paymentType === 'first_installment' || payment.paymentType === 'photo_access';
    const isSecondPayment = payment.paymentType === 'second_installment' || payment.paymentType === 'full_details';
    const paymentLabel = isFirstPayment ? 'First' : isSecondPayment ? 'Second' : '';

    await prisma.requestProgress.create({
      data: {
        employerRequestId: payment.employerRequestId,
        stage: stage,
        status: 'completed',
        description: `${paymentLabel} payment confirmed by ${confirmationName} (${confirmationPhone})`,
        completedAt: new Date()
      }
    });

    // Send email notifications (don't let email failures affect the main response)
    try {
      // Email to Admin - Payment confirmation received
      const isFirstPayment = payment.paymentType === 'first_installment' || payment.paymentType === 'photo_access';
      const isSecondPayment = payment.paymentType === 'second_installment' || payment.paymentType === 'full_details';
      
      const notificationType = isFirstPayment
        ? 'first_payment_confirmed'
        : isSecondPayment
          ? 'second_payment_confirmed'
          : 'payment_confirmed';
          
      const paymentDescription = isFirstPayment
        ? 'first installment'
        : isSecondPayment
          ? 'second installment'
          : 'payment';

      const paymentLabel = isFirstPayment ? 'First' : isSecondPayment ? 'Second' : '';

      await NotificationService.sendAdminNotification({
        type: notificationType,
        title: `${paymentLabel} Payment Confirmation Received`,
        message: `Employer ${payment.employerRequest.employerAccount.user.name} has confirmed ${paymentDescription} payment for request #${payment.employerRequestId}. Amount: ${payment.amount} ${payment.currency}`,
        employerRequestId: payment.employerRequestId
      });

      // Email to Employer - Confirmation received
      if (payment.employerRequest.employerAccount?.user?.email) {
        await NotificationService.sendEmail({
          to: payment.employerRequest.employerAccount.user.email,
          subject: 'Payment Confirmation Received - Braziconnect Portal',
          html: `
            <h2>Payment Confirmation Received</h2>
            <p>Dear ${payment.employerRequest.employerAccount.user.name},</p>
            <p>Your payment confirmation has been received and is being reviewed by our admin team.</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <h3>Payment Details:</h3>
              <p><strong>Amount:</strong> ${payment.amount} ${payment.currency}</p>
              <p><strong>Payment Reference:</strong> ${paymentReference || 'Not provided'}</p>
              <p><strong>Confirmed by:</strong> ${confirmationName} (${confirmationPhone})</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Admin will review your payment confirmation</li>
              <li>Access will be granted after approval</li>
              <li>You will be notified when access is granted</li>
            </ul>
            <p>Thank you for using our Braziconnect Portal service.</p>
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
        'Admin will review your payment confirmation',
        'Access will be granted after approval',
        'You will be notified when access is granted'
      ]
    });

  } catch (err) {
    console.error('Payment confirmation error:', err);
    res.status(500).json({ error: err.message || 'Failed to confirm payment.' });
  }
};

// Admin: Review payment confirmation
exports.reviewPaymentConfirmation = async (req, res) => {
  try {
    const prisma = await initPrisma();
    const { paymentId } = req.params;
    const { action, notes } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ 
        error: 'Action must be either "approve" or "reject".' 
      });
    }

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

    if (payment.status !== 'confirmed') {
      return res.status(400).json({ 
        error: 'Payment must be confirmed before review.' 
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

      // Grant access based on payment type
      const updateData = {};
      if (payment.paymentType === 'photo_access') {
        updateData.imageAccessGranted = true;
      } else if (payment.paymentType === 'full_details') {
        updateData.contactAccessGranted = true;
        updateData.imageAccessGranted = true;
      }
      
      updateData.accessGrantedAt = new Date();
      updateData.accessGrantedBy = req.user.id;

      // Update employer request
      await prisma.employerRequest.update({
        where: { id: payment.employerRequestId },
        data: updateData
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: 'access_granted',
          status: 'completed',
          description: `Payment approved - ${payment.paymentType === 'photo_access' ? 'Photo access' : 'Full details access'} granted`,
          completedAt: new Date(),
          completedBy: req.user.id
        }
      });

      res.json({
        message: 'Payment approved and access granted successfully',
        accessGranted: {
          type: payment.paymentType,
          photoAccess: updateData.imageAccessGranted,
          contactAccess: updateData.contactAccessGranted
        }
      });

    } else {
      // Reject payment
      await prisma.payment.update({
        where: { id: parseInt(paymentId, 10) },
        data: { status: 'rejected' }
      });

      await prisma.employerRequest.update({
        where: { id: payment.employerRequestId },
        data: { status: 'payment_rejected' }
      });

      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: 'payment_rejected',
          status: 'completed',
          description: `Payment rejected: ${notes || 'No reason provided'}`,
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
    console.error('Payment review error:', err);
    res.status(500).json({ error: err.message || 'Failed to review payment.' });
  }
};
