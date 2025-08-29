const { getPrismaClient } = require('../utils/database');
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

    // Update employer request status
    await prisma.employerRequest.update({
      where: { id: payment.employerRequestId },
      data: { status: 'payment_confirmed' }
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
