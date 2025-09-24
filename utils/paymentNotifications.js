const nodemailer = require('nodemailer');

// // Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
// Create transporter with domain SMTP
// const transporter = nodemailer.createTransport({
//   host: "mail.braziconnect.rw",   // SMTP server
//   port: 465,                      // Secure SSL/TLS port
//   secure: true,                   // true for port 465, false for 587
//   auth: {
//     user: "info@braziconnect.rw", //  domain email
//     pass: process.env.EMAIL_PASS  // email password 
//   },
//   tls: {
//     rejectUnauthorized: false // optional, sometimes needed with self-signed certs
//   }
// });

// Unified template
function paymentEmailTemplate({ title, subtitle, greeting, intro, sections = [], footerNote }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">${title}</h1>
        ${subtitle ? `<p style="margin: 10px 0 0 0; opacity: 0.9;">${subtitle}</p>` : ''}
      </div>

      <!-- Body -->
      <div style="padding: 30px; background-color: #ffffff;">
        ${greeting ? `<p>Dear ${greeting},</p>` : ''}
        ${intro ? `<p>${intro}</p>` : ''}

        ${sections.map(section => `
          <div style="background-color: ${section.bg}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${section.border};">
            <h3 style="color: ${section.textColor}; margin-top: 0;">${section.icon || ''} ${section.title}</h3>
            ${section.content}
          </div>
        `).join('')}

        <div class="signature" style="border-top: 2px solid #667eea; padding-top: 20px; margin-top: 30px;">
          <p>Best regards,</p>
          <div class="signature-name" style="font-weight: bold; color: #2c3e50;">The Brazi Connect Portal Team</div>
          <div class="signature-title" style="color: #667eea; font-size: 14px;">Customer Success Manager</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0; font-size: 12px; opacity: 0.8;">${footerNote || 'This is an automated notification from jobPortal Please do not reply to this email.'}</p>
      </div>
    </div>
  `;
}

/**
 * Send payment request notification to employer
 */
const sendPaymentRequestNotification = async (employerEmail, employerName, paymentDetails) => {
  try {
    const { amount, currency, paymentType, paymentMethod } = paymentDetails;

    const mailOptions = {
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: `Payment Request - ${paymentType === 'photo_access' ? 'Photo Access' : 'Full Details'}`,
      html: paymentEmailTemplate({
        title: 'Payment Request',
        subtitle: 'Action required: complete your payment',
        greeting: employerName,
        intro: 'We have generated a payment request for your Brazi Connect Portal transaction. Please review the details below and complete the payment to proceed.',
        sections: [
          {
            title: '💰 Payment Details',
            bg: '#f8f9fa',
            border: '#667eea',
            textColor: '#2c3e50',
            content: `
              <p><strong>Amount:</strong> ${amount} ${currency}</p>
              <p><strong>Payment Method:</strong> ${paymentMethod?.accountName || 'N/A'}</p>
              <p><strong>Description:</strong> ${paymentType === 'photo_access' ? 'Payment for photo access' : 'Payment for full details'}</p>
            `
          },
          {
            title: '📋 Next Steps',
            bg: '#fff3cd',
            border: '#ffc107',
            textColor: '#856404',
            content: `
              <ol style="margin: 5px 0; padding-left: 20px;">
                <li>Pay the requested amount using the provided payment method</li>
                <li>Confirm your payment in the portal</li>
                <li>Wait for admin approval and access to candidate details</li>
              </ol>
            `
          }
        ]
      })
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
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: adminEmail,
      subject: `Payment Confirmation Received`,
      html: paymentEmailTemplate({
        title: 'Payment Confirmation',
        subtitle: 'A new payment requires your review',
        intro: 'A candidate employer has submitted a payment confirmation. Please review the details below.',
        sections: [
          {
            title: '📄 Payment Information',
            bg: '#f8f9fa',
            border: '#667eea',
            textColor: '#2c3e50',
            content: `
              <p><strong>Payment ID:</strong> ${paymentDetails.id}</p>
              <p><strong>Amount:</strong> ${paymentDetails.amount} ${paymentDetails.currency}</p>
              <p><strong>Type:</strong> ${paymentDetails.paymentType}</p>
            `
          },
          {
            title: '⚡ Action Required',
            bg: '#fff3cd',
            border: '#ffc107',
            textColor: '#856404',
            content: '<p>Please review and approve/reject this payment in the admin portal.</p>'
          }
        ]
      })
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
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: `Payment Approved - Access Granted`,
      html: paymentEmailTemplate({
        title: 'Payment Approved!',
        subtitle: 'Your access has been granted',
        greeting: employerName,
        intro: 'We are pleased to inform you that your payment has been approved and access has been granted.',
        sections: [
          {
            title: '✅ Access Granted',
            bg: '#e8f5e8',
            border: '#28a745',
            textColor: '#155724',
            content: `
              <p><strong>Photo Access:</strong> ${accessGranted.photoAccess ? 'Yes' : 'No'}</p>
              <p><strong>Contact Access:</strong> ${accessGranted.contactAccess ? 'Yes' : 'No'}</p>
            `
          },
          {
            title: '🚀 Next Steps',
            bg: '#f8f9fa',
            border: '#667eea',
            textColor: '#2c3e50',
            content: '<p>You can now log in to your dashboard and view the candidate details.</p>'
          }
        ]
      })
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
