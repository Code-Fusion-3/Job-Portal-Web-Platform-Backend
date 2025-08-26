const nodemailer = require('nodemailer');

// Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

/**
 * Send payment request notification to employer
 */
const sendPaymentRequestNotification = async (employerEmail, employerName, paymentDetails) => {
  try {
    const { amount, currency, paymentType, paymentMethod } = paymentDetails;
    
    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: `Payment Request - ${paymentType === 'photo_access' ? 'Photo Access' : 'Full Details'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Request</h2>
          <p>Hello ${employerName},</p>
          <p>Please complete payment of ${amount} ${currency} for ${paymentType === 'photo_access' ? 'photo access' : 'full details'}.</p>
          <p><strong>Account:</strong> ${paymentMethod.accountName}</p>
          <p><strong>Number:</strong> ${paymentMethod.accountNumber}</p>
          <p>Confirm your payment after transfer.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment request notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send payment request notification:', error);
    return false;
  }
};

/**
 * Send payment confirmation notification to admin
 */
const sendPaymentConfirmationNotification = async (adminEmail, paymentDetails) => {
  try {
    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: adminEmail,
      subject: `Payment Confirmation Received`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Confirmation</h2>
          <p>A new payment confirmation requires your review.</p>
          <p><strong>Payment ID:</strong> ${paymentDetails.id}</p>
          <p><strong>Amount:</strong> ${paymentDetails.amount} ${paymentDetails.currency}</p>
          <p><strong>Type:</strong> ${paymentDetails.paymentType}</p>
          <p>Please review and approve/reject this payment.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment confirmation notification sent to admin:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send payment confirmation notification to admin:', error);
    return false;
  }
};

/**
 * Send payment approval notification to employer
 */
const sendPaymentApprovalNotification = async (employerEmail, employerName, accessGranted) => {
  try {
    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: `Payment Approved - Access Granted`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Payment Approved!</h2>
          <p>Hello ${employerName},</p>
          <p>Your payment has been approved and access granted.</p>
          <p><strong>Photo Access:</strong> ${accessGranted.photoAccess ? 'Yes' : 'No'}</p>
          <p><strong>Contact Access:</strong> ${accessGranted.contactAccess ? 'Yes' : 'No'}</p>
          <p>You can now view the candidate details in your dashboard.</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment approval notification sent to employer:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send payment approval notification to employer:', error);
    return false;
  }
};

module.exports = {
  sendPaymentRequestNotification,
  sendPaymentConfirmationNotification,
  sendPaymentApprovalNotification
};
