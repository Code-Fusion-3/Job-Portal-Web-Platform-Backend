const { getPrismaClient } = require('../utils/database');
const NotificationService = require('./notificationService');

/**
 * Payment Service for managing payment workflow
 */
class PaymentService {
  /**
   * Create first payment request
   * @param {number} employerRequestId - Employer request ID
   * @param {number} amount - Payment amount (default: 5000)
   */
  static async createFirstPaymentRequest(employerRequestId, amount = 5000) {
    try {
      const prisma = await getPrismaClient();

      // Get employer request details
      const employerRequest = await prisma.employerRequest.findUnique({
        where: { id: employerRequestId },
        include: {
          employerAccount: {
            include: { user: true }
          },
          requestedCandidate: true
        }
      });

      if (!employerRequest) {
        throw new Error('Employer request not found');
      }

      // Get first active payment method
      const firstActiveMethod = await prisma.paymentMethod.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      if (!firstActiveMethod) {
        throw new Error('No active payment method found. Please add a payment method before requesting payment.');
      }

      // Create first payment
      const payment = await prisma.payment.create({
        data: {
          employerRequestId,
          amount: amount,
          currency: 'RWF',
          paymentMethodId: firstActiveMethod.id,
          paymentType: 'first_installment',
          paymentReference: `PAY-${Date.now()}-${employerRequestId}`,
          status: 'pending',
          description: 'First installment for photo access',
          installmentNumber: 1,
          isNonRefundable: true // First installment is non-refundable
        }
      });

      // Update employer request
      await prisma.employerRequest.update({
        where: { id: employerRequestId },
        data: {
          firstPaymentRequired: true,
          firstPaymentAmount: amount,
          status: 'first_payment_required'
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId,
          stage: 'first_payment_required',
          status: 'completed',
          description: `First payment of ${amount} RWF requested for photo access`,
          completedAt: new Date()
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        employerRequest.employerAccount.userId,
        {
          type: 'payment_request',
          title: 'Payment Required',
          message: `Please pay ${amount} RWF for photo access to candidate information.`,
          employerRequestId
        }
      );

      console.log(`✅ First payment request created for request ${employerRequestId}: ${amount} RWF`);
      return payment;
    } catch (error) {
      console.error('❌ Error creating first payment request:', error);
      throw error;
    }
  }

  /**
   * Create second payment request
   * @param {number} employerRequestId - Employer request ID
   * @param {number} amount - Payment amount (default: 10000)
   */
  static async createSecondPaymentRequest(employerRequestId, amount = 10000) {
    try {
      const prisma = await getPrismaClient();

      // Get employer request details
      const employerRequest = await prisma.employerRequest.findUnique({
        where: { id: employerRequestId },
        include: {
          employerAccount: {
            include: { user: true }
          },
          requestedCandidate: true
        }
      });

      if (!employerRequest) {
        throw new Error('Employer request not found');
      }

      // Get first active payment method
      const firstActiveMethod = await prisma.paymentMethod.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      if (!firstActiveMethod) {
        throw new Error('No active payment method found. Please add a payment method before requesting payment.');
      }

      // Create second payment
      const payment = await prisma.payment.create({
        data: {
          employerRequestId,
          amount: amount,
          currency: 'RWF',
          paymentMethodId: firstActiveMethod.id,
          paymentType: 'second_installment',
          paymentReference: `PAY-${Date.now()}-${employerRequestId}-2`,
          status: 'pending',
          description: 'Second installment for full details access',
          installmentNumber: 2,
          isNonRefundable: false // Second installment is refundable
        }
      });

      // Update employer request
      await prisma.employerRequest.update({
        where: { id: employerRequestId },
        data: {
          secondPaymentRequired: true,
          secondPaymentAmount: amount,
          status: 'second_payment_required'
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId,
          stage: 'second_payment_required',
          status: 'completed',
          description: `Second payment of ${amount} RWF requested for full details access`,
          completedAt: new Date()
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        employerRequest.employerAccount.userId,
        {
          type: 'payment_request',
          title: 'Second Payment Required',
          message: `Please pay ${amount} RWF for full access to candidate information.`,
          employerRequestId
        }
      );

      console.log(`✅ Second payment request created for request ${employerRequestId}: ${amount} RWF`);
      return payment;
    } catch (error) {
      console.error('❌ Error creating second payment request:', error);
      throw error;
    }
  }

  /**
   * Confirm payment (when employer confirms they made payment)
   * @param {number} paymentId - Payment ID
   * @param {Object} confirmationData - Payment confirmation data
   */
  static async confirmPayment(paymentId, confirmationData) {
    try {
      const prisma = await getPrismaClient();

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'confirmed',
          confirmationName: confirmationData.name,
          confirmationPhone: confirmationData.phone,
          confirmationDate: new Date()
        },
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

      // Update employer request status
      const newStatus = payment.paymentType === 'first_installment'
        ? 'first_payment_confirmed'
        : 'second_payment_confirmed';

      await prisma.employerRequest.update({
        where: { id: payment.employerRequestId },
        data: {
          status: newStatus,
          ...(payment.paymentType === 'first_installment'
            ? { firstPaymentConfirmed: true, firstPaymentConfirmedAt: new Date() }
            : { secondPaymentConfirmed: true, secondPaymentConfirmedAt: new Date() }
          )
        }
      });

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: newStatus,
          status: 'completed',
          description: `Payment confirmed by employer: ${confirmationData.name}`,
          completedAt: new Date()
        }
      });

      // Send notification to admin
      await NotificationService.sendAdminNotification({
        type: 'payment_confirmed',
        title: 'Payment Confirmation Received',
        message: `Employer ${payment.employerRequest.employerAccount.user.name} has confirmed payment of ${payment.amount} RWF. Please review and approve.`,
        employerRequestId: payment.employerRequestId
      });

      console.log(`✅ Payment ${paymentId} confirmed by employer`);
      return payment;
    } catch (error) {
      console.error('❌ Error confirming payment:', error);
      throw error;
    }
  }

  /**
   * Approve payment (admin approves confirmed payment)
   * @param {number} paymentId - Payment ID
   * @param {number} adminId - Admin ID
   * @param {string} notes - Admin notes
   */
  static async approvePayment(paymentId, adminId, notes = '') {
    try {
      const prisma = await getPrismaClient();

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'approved',
          adminNotes: notes
        },
        include: {
          employerRequest: {
            include: {
              employerAccount: {
                include: { user: true }
              },
              requestedCandidate: true
            }
          }
        }
      });

      // Update employer request based on payment type
      let newStatus, accessGranted, notificationType, notificationTitle, notificationMessage;

      if (payment.paymentType === 'first_installment') {
        newStatus = 'photo_access_granted';
        accessGranted = { partialAccessGranted: true };
        notificationType = 'photo_access_granted';
        notificationTitle = 'Photo Access Granted';
        notificationMessage = 'Your payment has been approved! You now have access to candidate photo.';

        await prisma.employerRequest.update({
          where: { id: payment.employerRequestId },
          data: {
            status: newStatus,
            firstPaymentApprovedBy: adminId,
            firstPaymentApprovedAt: new Date(),
            ...accessGranted
          }
        });
      } else if (payment.paymentType === 'second_installment') {
        newStatus = 'full_access_granted';
        accessGranted = { fullAccessGranted: true };
        notificationType = 'full_access_granted';
        notificationTitle = 'Full Access Granted';
        notificationMessage = 'Your payment has been approved! You now have full access to candidate details.';

        await prisma.employerRequest.update({
          where: { id: payment.employerRequestId },
          data: {
            status: newStatus,
            secondPaymentApprovedBy: adminId,
            secondPaymentApprovedAt: new Date(),
            ...accessGranted
          }
        });
      }

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: newStatus,
          status: 'completed',
          description: `Payment approved by admin. ${payment.paymentType === 'first_installment' ? 'Photo access granted.' : 'Full access granted.'}`,
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        payment.employerRequest.employerAccount.userId,
        {
          type: notificationType,
          title: notificationTitle,
          message: notificationMessage,
          employerRequestId: payment.employerRequestId
        }
      );

      console.log(`✅ Payment ${paymentId} approved by admin ${adminId}`);
      return payment;
    } catch (error) {
      console.error('❌ Error approving payment:', error);
      throw error;
    }
  }

  /**
   * Reject payment (admin rejects confirmed payment)
   * @param {number} paymentId - Payment ID
   * @param {number} adminId - Admin ID
   * @param {string} reason - Rejection reason
   */
  static async rejectPayment(paymentId, adminId, reason = '') {
    try {
      const prisma = await getPrismaClient();

      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'rejected',
          adminNotes: reason
        },
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

      // Create progress tracking
      await prisma.requestProgress.create({
        data: {
          employerRequestId: payment.employerRequestId,
          stage: 'payment_rejected',
          status: 'failed',
          description: `Payment rejected by admin. Reason: ${reason}`,
          completedAt: new Date(),
          completedBy: adminId
        }
      });

      // Send notification to employer
      await NotificationService.sendEmployerNotification(
        payment.employerRequest.employerAccount.userId,
        {
          type: 'payment_rejected',
          title: 'Payment Rejected',
          message: `Your payment has been rejected.${reason ? ` Reason: ${reason}` : ''} Please contact admin for assistance.`,
          employerRequestId: payment.employerRequestId
        }
      );

      console.log(`✅ Payment ${paymentId} rejected by admin ${adminId}`);
      return payment;
    } catch (error) {
      console.error('❌ Error rejecting payment:', error);
      throw error;
    }
  }

  /**
   * Get payment details
   * @param {number} paymentId - Payment ID
   */
  static async getPaymentDetails(paymentId) {
    try {
      const prisma = await getPrismaClient();

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          employerRequest: {
            include: {
              employerAccount: {
                include: { user: true }
              },
              requestedCandidate: true
            }
          },
          paymentMethod: true,
          approvals: {
            include: {
              admin: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      return payment;
    } catch (error) {
      console.error('❌ Error getting payment details:', error);
      throw error;
    }
  }
}

module.exports = PaymentService;
