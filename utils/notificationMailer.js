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
// Send notification email to admin when admin replies
const sendAdminReplyNotification = async (employerEmail, employerName, adminMessage, attachmentName = null) => {
    try {
      const attachmentText = attachmentName ? `\n\n📎 Attachment: ${attachmentName}` : '';
  
      const mailOptions = {
        from: `"Braziconnect Portal Admin" <${process.env.GMAIL_USER}>`,
        to: employerEmail,
        subject: 'Response to Your Job Request - Braziconnect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Response to Your Job Request</h2>
            <p>Dear ${employerName},</p>
            <p>We have received your job request and would like to provide you with a response:</p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              ${adminMessage}
            </div>
            ${attachmentName ? `<p><strong>📎 Attachment:</strong> ${attachmentName}</p>` : ''}
            <p>If you have any questions or need further assistance, please don't hesitate to contact us.</p>
            <p>Best regards,<br>Braziconnect Portal Team</p>
            <p style="color: #7f8c8d; font-size: 12px;">
              This is an automated response from jobPortal
            </p>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Admin reply notification sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending admin reply notification:', error);
      return false;
    }
  };
  
  // Send notification email to employer when admin replies
  const sendEmployerReplyNotification = async (employerEmail, employerName, employerMessage, attachmentName = null) => {
    try {
      const attachmentText = attachmentName ? `\n\n📎 Attachment: ${attachmentName}` : '';
  
      const mailOptions = {
        from: `"Braziconnect Portal" <${process.env.GMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER,
        subject: 'Employer Reply - Braziconnect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Employer Reply Received</h2>
            <p><strong>From:</strong> ${employerName} (${employerEmail})</p>
            <p><strong>Message:</strong></p>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
              ${employerMessage}
            </div>
            ${attachmentName ? `<p><strong>📎 Attachment:</strong> ${attachmentName}</p>` : ''}
            <p>Please log in to your admin dashboard to respond to this message.</p>
            <p style="color: #7f8c8d; font-size: 12px;">
              This is an automated notification from jobPortal
            </p>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Employer reply notification sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending employer reply notification:', error);
      return false;
    }
  };
  
  // Send approval notification email to employer
  const sendRequestApprovalNotification = async (employerEmail, employerName, selectedUser, adminNotes = null) => {
    try {
      let candidateInfo = '';
      if (selectedUser && selectedUser.profile) {
        const location = [selectedUser.profile.city, selectedUser.profile.country].filter(Boolean).join(', ');
        candidateInfo = `
          <h3 style="color: #2c3e50; margin-top: 20px;">Selected Candidate Details:</h3>
          <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 10px 0;">
            <p><strong>Name:</strong> ${selectedUser.profile.firstName} ${selectedUser.profile.lastName}</p>
            <p><strong>Experience:</strong> ${selectedUser.profile.experience || 'Not specified'}</p>
            <p><strong>Location:</strong> ${location || 'Not specified'}</p>
            <p><strong>Skills:</strong> ${selectedUser.profile.skills || 'Not specified'}</p>
            <p><strong>Contact:</strong> ${selectedUser.profile.contactNumber || 'Available through admin'}</p>
          </div>
        `;
      }
  
      const notesInfo = adminNotes ? `
        <h3 style="color: #2c3e50; margin-top: 20px;">Admin Notes:</h3>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ffc107;">
          ${adminNotes}
        </div>
      ` : '';
  
      const mailOptions = {
        from: `"Braziconnect Portal Admin" <${process.env.GMAIL_USER}>`,
        to: employerEmail,
        subject: 'Your Job Request Has Been Approved - Braziconnect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">✅ Request Approved</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your job request has been approved</p>
            </div>
            
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #2c3e50;">Congratulations!</h2>
              <p>Dear ${employerName},</p>
              <p>We are pleased to inform you that your job request has been <strong>approved</strong> by our admin team.</p>
              
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
                <h3 style="color: #155724; margin-top: 0;">What happens next?</h3>
                <ul style="color: #155724; margin: 10px 0;">
                  <li>Our team will contact you within 24 hours to discuss next steps</li>
                  <li>We'll coordinate the introduction between you and the selected candidate</li>
                  <li>All further communication will be handled through our admin team</li>
                </ul>
              </div>
              
              ${candidateInfo}
              ${notesInfo}
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2c3e50; margin-top: 0;">Important Notice</h3>
                <p style="color: #6c757d; margin: 0;">
                  <strong>Communication is now closed for this request.</strong> All further inquiries should be directed to our admin team through the main contact channels.
                </p>
              </div>
              
              <p>Thank you for choosing our platform for your hiring needs.</p>
              <p>Best regards,<br><strong>Braziconnect Portal Team</strong></p>
            </div>
            
            <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                This is an automated notification from jobPortal Please do not reply to this email.
              </p>
            </div>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Request approval notification sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending request approval notification:', error);
      return false;
    }
  };
  
  // Send status update notification email to employer
  const sendStatusUpdateNotification = async (to, candidateName, newStatus, adminNotes = null, requestDetails = null) => {
    try {
      if (newStatus === 'request_received') {
        const name = candidateName || 'Candidate';
        const subject = 'Status Update - Braziconnect Portal';
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">Status Update</h2>
            <p>Dear <strong>${name}</strong>,</p>
            <p>🎉 Congratulations! An employer has shown interest in you. Your profile has been requested by an employer.</p>
            <p>This is a great opportunity—please stay attentive as we will provide you with updates on the next steps.</p>
            <p>We wish you success in your journey ahead!</p>
            <hr style="margin: 32px 0; border: none; border-top: 1px solid #eee;" />
            <h2 style="color: #2c3e50;">Amakuru Mashya</h2>
            <p>Mukandida Mukwiye,</p>
            <p>Turabashimiye kandi tubifurije ishya n'ihirwe! Hari umukoresha wakwishimiye. Umwirondoro wanyu wasabwe n'umukoresha.</p>
            <p>Iya ni amahirwe akomeye—mukomeze kuba maso kuko tuzajya tubagezaho amakuru y'ibizakurikiraho.</p>
            <p>Tubifurije amahirwe masa mu rugendo rwanyu rw'akazi!</p>
          </div>
        `;
        await sendEmail({ to, subject, html });
        return;
      }
      console.log(`📧 Preparing status update email for: ${to}`);
  
      console.log(`📋 Email details - Name: ${candidateName}, Status: ${newStatus}, Notes: ${adminNotes || 'None'}`);
  
      // Check email configuration
      console.log(`🔧 Email configuration check:`);
      console.log(`   - GMAIL_USER: ${process.env.GMAIL_USER ? 'Set' : 'NOT SET'}`);
      console.log(`   - GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'Set' : 'NOT SET'}`);
      console.log(`   - Transporter ready: ${transporter ? 'Yes' : 'No'}`);
  
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error('❌ Email configuration missing - GMAIL_USER or GMAIL_APP_PASSWORD not set');
        return false;
      }
  
      const statusConfig = {
        'in_progress': {
          title: '🔄 Request In Progress',
          color: '#007bff',
          message: 'Your job request is now being processed by our team.'
        },
        'completed': {
          title: '✅ Request Completed',
          color: '#28a745',
          message: 'Your job request has been completed successfully.'
        },
        'cancelled': {
          title: '❌ Request Cancelled',
          color: '#dc3545',
          message: 'Your job request has been cancelled.'
        }
      };
  
      const config = statusConfig[newStatus] || {
        title: '📝 Status Updated',
        color: '#6c757d',
        message: `Your job request status has been updated to ${newStatus}.`
      };
  
      // Request details section
      const requestInfo = requestDetails ? `
        <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
          <h3 style="color: #2c3e50; margin-top: 0;">Request Details:</h3>
          ${requestDetails.companyName ? `<p><strong>Company:</strong> ${requestDetails.companyName}</p>` : ''}
          ${requestDetails.phoneNumber ? `<p><strong>Phone:</strong> ${requestDetails.phoneNumber}</p>` : ''}
          <p><strong>Original Message:</strong></p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; font-style: italic;">
            ${requestDetails.message || 'No message provided'}
          </div>
        </div>
      ` : '';
  
      const notesInfo = adminNotes ? `
        <h3 style="color: #2c3e50; margin-top: 20px;">Admin Notes:</h3>
        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #ffc107;">
          ${adminNotes}
        </div>
      ` : '';
  
      const mailOptions = {
        from: `"Braziconnect Portal Admin" <${process.env.GMAIL_USER}>`,
        to: to,
        subject: adminNotes
          ? `Job Request Update - Admin Notes - Braziconnect Portal`
          : `Job Request Status Update - ${newStatus.toUpperCase()} - Braziconnect Portal`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 28px;">${config.title}</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${config.message}</p>
            </div>
            
            <div style="padding: 30px; background-color: #ffffff;">
              <h2 style="color: #2c3e50;">Status Update</h2>
              <p>Dear ${candidateName || 'Candidate'},</p>
              <p>We would like to inform you that the status of your job request has been updated to <strong>${newStatus}</strong>.</p>
              
              ${requestInfo}
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #2c3e50; margin-top: 0;">Current Status: ${newStatus.toUpperCase()}</h3>
                <p style="color: #6c757d; margin: 0;">
                  ${config.message}
                </p>
              </div>
              
              ${notesInfo}
              
              <p>If you have any questions about this status update, please contact our support team.</p>
              <p>Best regards,<br><strong>Braziconnect Portal Team</strong></p>
            </div>
            
            <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; opacity: 0.8;">
                This is an automated notification from jobPortal Please do not reply to this email.
              </p>
            </div>
          </div>
        `
      };
  
      console.log(`📤 Attempting to send email to: ${to}`);
      console.log(`📧 From: ${process.env.GMAIL_USER}`);
      console.log(`📧 Subject: ${mailOptions.subject}`);
  
      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Status update notification sent successfully:', info.messageId);
      console.log(`📧 Email sent to: ${to}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending status update notification:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        command: error.command
      });
      return false;
    }
  };
  
  // Send password reset email
  const sendPasswordResetEmail = async (email, firstName, resetUrl, footerContact = null) => {
    try {
      const mailOptions = {
        from: `"Braziconnect Portal Security" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Request - Braziconnect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #e74c3c; text-align: center; margin-bottom: 30px;">Password Reset Request 🔐</h1>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">Dear ${firstName},</p>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                We received a request to reset your password for your Braziconnect Portal account. 
                If you didn't make this request, you can safely ignore this email.
              </p>
              
              <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h3 style="color: #856404; margin-top: 0;">⚠️ Important Security Notice</h3>
                <p style="color: #856404; font-size: 14px; margin-bottom: 0;">
                  This password reset link will expire in 1 hour for your security.
                </p>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #e74c3c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Reset My Password
                </a>
              </div>
              
              <p style="color: #7f8c8d; font-size: 14px; text-align: center;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${resetUrl}" style="color: #3498db; word-break: break-all;">${resetUrl}</a>
              </p>
              
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              
              <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
                <p><strong>Braziconnect Portal Security Team</strong></p>
                <p>If you didn't request this password reset, please contact us immediately.</p>
                <p>${footerContact ? footerContact : 'Email: info@braziconnect.rw | Phone: +250 789 176 625'}</p>
                <p>© 2024 jobPortal All rights reserved.</p>
              </div>
            </div>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  };
  
  // Send password reset confirmation email
  const sendPasswordResetConfirmation = async (email) => {
    try {
      const mailOptions = {
        from: `"Braziconnect Portal Security" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Password Reset Successful - Braziconnect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #27ae60; text-align: center; margin-bottom: 30px;">Password Reset Successful ✅</h1>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                Your password has been successfully reset. Your account is now secure with your new password.
              </p>
              
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                <h3 style="color: #155724; margin-top: 0;">🔒 Security Actions Taken</h3>
                <ul style="color: #155724; font-size: 14px;">
                  <li>Your password has been updated</li>
                  <li>All active sessions have been terminated</li>
                  <li>You'll need to log in again with your new password</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                   style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Login with New Password
                </a>
              </div>
              
              <p style="color: #7f8c8d; font-size: 14px; text-align: center;">
                If you didn't perform this password reset, change password or please contact our security team immediately.
              </p>
              
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              
              <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
                <p><strong>Braziconnect Portal Security Team</strong></p>
                <p>Email: info@braziconnect.rw | Phone: +250 789 176 625</p>
                <p>© 2024 jobPortal All rights reserved.</p>
              </div>
            </div>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset confirmation email sent:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset confirmation email:', error);
      return false;
    }
  };
// Send candidate picture notification to employer
const sendCandidatePictureNotification = async (employerEmail, employerName, candidate) => {
    // This function should send an email to the employer with the candidate's profile picture and basic information.
  };
  
  // Send candidate full details notification to employer
  const sendCandidateFullDetailsNotification = async (employerEmail, employerName, candidate) => {
    // This function should send an email to the employer with the candidate's full details and contact information.
  };

  module.exports = {
    sendAdminReplyNotification,
    sendEmployerReplyNotification,
    sendRequestApprovalNotification,
    sendStatusUpdateNotification,
    sendPasswordResetEmail,
    sendPasswordResetConfirmation,
    sendCandidatePictureNotification,
    sendCandidateFullDetailsNotification
  };