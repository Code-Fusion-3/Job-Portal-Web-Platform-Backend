const nodemailer = require('nodemailer');

// Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Professional email template
const getWelcomeEmailTemplate = (userName, userEmail) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Job Portal</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .tagline {
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 40px 30px;
        }
        .welcome-text {
          font-size: 18px;
          margin-bottom: 25px;
          color: #2c3e50;
        }
        .features {
          background-color: #f8f9fa;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
          display:none;
        }
        .features h3 {
          color: #2c3e50;
          margin-top: 0;
        }
        .features ul {
          margin: 15px 0;
          padding-left: 20px;
        }
        .features li {
          margin-bottom: 8px;
          color: #555;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 30px;
          text-decoration: none;
          border-radius: 25px;
          font-weight: bold;
          margin: 20px 0;
        }
        .footer {
          background-color: #2c3e50;
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .contact-info {
          margin: 20px 0;
          font-size: 14px;
        }
        .social-links {
          margin: 20px 0;
        }
        .social-links a {
          color: #667eea;
          text-decoration: none;
          margin: 0 10px;
        }
        .signature {
          border-top: 2px solid #667eea;
          padding-top: 20px;
          margin-top: 30px;
        }
        .signature-name {
          font-weight: bold;
          color: #2c3e50;
        }
        .signature-title {
          color: #667eea;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Job Portal</div>
          <div class="tagline">Connecting Talent with Opportunity</div>
        </div>
        
        <div class="content">
          <div class="welcome-text">
            Dear <strong>${userName}</strong>,
          </div>
          
          <p>Welcome to <strong>Job Portal</strong>! We're thrilled to have you join our community of professionals and employers.</p>
          
          <p>Your account has been successfully created with the email: <strong>${userEmail}</strong></p>
          
          <div class="features">
            <h3>🚀 What you can do now:</h3>
            <ul>
              <li><strong>Complete your profile</strong> - Add your skills, experience, and preferences</li>
              <li><strong>Browse opportunities</strong> - Discover job openings from top employers</li>
              <li><strong>Connect with employers</strong> - Get noticed by companies looking for your skills</li>
              <li><strong>Track applications</strong> - Monitor your job application status</li>
            </ul>
          </div>
          
          <p>We're committed to helping you find the perfect opportunity that matches your skills and career goals.</p>
          
          <div style="text-align: center;">
            <a href="#" class="cta-button">Complete Your Profile</a>
          </div>
          
          <div class="signature">
            <p>Best regards,</p>
            <div class="signature-name">The Job Portal Team</div>
            <div class="signature-title">Customer Success Manager</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="contact-info">
            <p><strong>Job Portal</strong></p>
            <p>📍 Kigali, Rwanda</p>
            <p>📧 support@jobportal.com</p>
            <p>📞 +250 788 123 456</p>
          </div>
          
          <div class="social-links">
            <a href="#">LinkedIn</a> |
            <a href="#">Twitter</a> |
            <a href="#">Facebook</a>
          </div>
          
          <p style="font-size: 12px; opacity: 0.8; margin-top: 20px;">
            © 2024 Job Portal. All rights reserved.<br>
            This email was sent to ${userEmail}. If you didn't sign up for Job Portal, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send welcome email to newly registered user
const sendWelcomeEmail = async (userEmail, userName = 'User') => {
  try {
    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: 'Welcome to Job Portal - Your Account is Ready! 🎉',
      html: getWelcomeEmailTemplate(userName, userEmail)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};

// Send notification email to admin when employer submits request
const sendEmployerRequestNotification = async (employerName, employerEmail, message, phoneNumber, companyName, requestedCandidateId) => {
  try {
    // Get candidate details if requested
    let candidateInfo = '';
    if (requestedCandidateId) {
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        const candidate = await prisma.user.findUnique({
          where: { id: parseInt(requestedCandidateId, 10) },
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                skills: true,
                experience: true,
                location: true,
                city: true,
                country: true
              }
            }
          }
        });
        
        if (candidate && candidate.profile) {
          const location = [candidate.profile.city, candidate.profile.country].filter(Boolean).join(', ');
          candidateInfo = `
            <h3 style="color: #2c3e50; margin-top: 20px;">Requested Candidate Details:</h3>
            <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 10px 0;">
              <p><strong>Name:</strong> ${candidate.profile.firstName} ${candidate.profile.lastName}</p>
              <p><strong>Experience:</strong> ${candidate.profile.experience || 'Not specified'}</p>
              <p><strong>Location:</strong> ${location || 'Not specified'}</p>
              <p><strong>Skills:</strong> ${candidate.profile.skills || 'Not specified'}</p>
            </div>
          `;
        }
      } catch (candidateError) {
        console.error('Error fetching candidate details:', candidateError);
      }
    }

    const phoneInfo = phoneNumber ? `<p><strong>Phone Number:</strong> ${phoneNumber}</p>` : '';
    const companyInfo = companyName ? `<p><strong>Company Name:</strong> ${companyName}</p>` : '';

    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER, // Send to admin
      subject: 'New Employer Request - Job Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">New Employer Request</h2>
          <p><strong>Employer Name:</strong> ${employerName}</p>
          <p><strong>Employer Email:</strong> ${employerEmail}</p>
          ${phoneInfo}
          ${companyInfo}
          <p><strong>Message:</strong></p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
            ${message || 'No message provided'}
          </div>
          ${candidateInfo}
          <p>Please log in to your admin dashboard to respond to this request.</p>
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated notification from Job Portal.
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Employer request notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending employer request notification:', error);
    return false;
  }
};

// Send notification email to employer when admin replies
const sendAdminReplyNotification = async (employerEmail, employerName, adminMessage, attachmentName = null) => {
  try {
    const attachmentText = attachmentName ? `\n\n📎 Attachment: ${attachmentName}` : '';
    
    const mailOptions = {
      from: `"Job Portal Admin" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: 'Response to Your Job Request - Job Portal',
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
          <p>Best regards,<br>Job Portal Team</p>
          <p style="color: #7f8c8d; font-size: 12px;">
            This is an automated response from Job Portal.
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

// Send notification email to admin when employer replies
const sendEmployerReplyNotification = async (employerEmail, employerName, employerMessage, attachmentName = null) => {
  try {
    const attachmentText = attachmentName ? `\n\n📎 Attachment: ${attachmentName}` : '';
    
    const mailOptions = {
      from: `"Job Portal" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER,
      subject: 'Employer Reply - Job Portal',
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
            This is an automated notification from Job Portal.
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

// Send password reset email
const sendPasswordResetEmail = async (email, firstName, resetUrl) => {
  try {
    const mailOptions = {
      from: `"Job Portal Security" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - Job Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #e74c3c; text-align: center; margin-bottom: 30px;">Password Reset Request 🔐</h1>
            
            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">Dear ${firstName},</p>
            
            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for your Job Portal account. 
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
              <p><strong>Job Portal Security Team</strong></p>
              <p>If you didn't request this password reset, please contact us immediately.</p>
              <p>Email: security@jobportal.com | Phone: +250 788 123 456</p>
              <p>© 2024 Job Portal. All rights reserved.</p>
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
      from: `"Job Portal Security" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Successful - Job Portal',
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
              If you didn't perform this password reset, please contact our security team immediately.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            
            <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
              <p><strong>Job Portal Security Team</strong></p>
              <p>Email: security@jobportal.com | Phone: +250 788 123 456</p>
              <p>© 2024 Job Portal. All rights reserved.</p>
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

// Send contact notification to admin
const sendContactNotification = async (contact) => {
  try {
    const mailOptions = {
      from: `"Job Portal Contact System" <${process.env.GMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.GMAIL_USER,
      subject: `New Contact Message: ${contact.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #3498db; text-align: center; margin-bottom: 30px;">📧 New Contact Message</h1>
            
            <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h3 style="color: #2980b9; margin-top: 0;">Message Details</h3>
              <p><strong>From:</strong> ${contact.name} (${contact.email})</p>
              <p><strong>Subject:</strong> ${contact.subject}</p>
              <p><strong>Category:</strong> ${contact.category}</p>
              <p><strong>Priority:</strong> ${contact.priority}</p>
              <p><strong>Received:</strong> ${new Date(contact.createdAt).toLocaleString()}</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #2c3e50; margin-top: 0;">Message Content:</h4>
              <p style="color: #34495e; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${contact.message}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/contacts/${contact.id}" 
                 style="background-color: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                View & Respond
              </a>
            </div>
            
            <p style="color: #7f8c8d; font-size: 12px; text-align: center;">
              This is an automated notification from the Job Portal Contact System.
            </p>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact notification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending contact notification email:', error);
    return false;
  }
};

// Send contact response to user
const sendContactResponse = async (contact) => {
  try {
    const mailOptions = {
      from: `"Job Portal Support" <${process.env.GMAIL_USER}>`,
      to: contact.email,
      subject: `Re: ${contact.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h1 style="color: #27ae60; text-align: center; margin-bottom: 30px;">📧 Response to Your Message</h1>
            
            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">Dear ${contact.name},</p>
            
            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
              Thank you for contacting Job Portal. We have received your message and would like to provide you with a response.
            </p>
            
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
              <h3 style="color: #155724; margin-top: 0;">Our Response:</h3>
              <p style="color: #155724; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${contact.adminResponse}</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #2c3e50; margin-top: 0;">Your Original Message:</h4>
              <p style="color: #7f8c8d; font-size: 12px; line-height: 1.4; white-space: pre-wrap;">${contact.message}</p>
            </div>
            
            <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
              If you have any further questions or need additional assistance, please don't hesitate to contact us again.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/contact" 
                 style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Contact Us Again
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            
            <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
              <p><strong>Job Portal Support Team</strong></p>
              <p>Email: support@jobportal.com | Phone: +250 788 123 456</p>
              <p>© 2024 Job Portal. All rights reserved.</p>
            </div>
          </div>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('Contact response email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending contact response email:', error);
    return false;
  }
};

module.exports = {
  sendWelcomeEmail,
  sendEmployerRequestNotification,
  sendAdminReplyNotification,
  sendEmployerReplyNotification,
  sendPasswordResetEmail,
  sendPasswordResetConfirmation,
  sendContactNotification,
  sendContactResponse
}; 