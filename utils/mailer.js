const nodemailer = require('nodemailer');

// Create transporter with Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});
// // Create transporter with domain SMTP
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

// Resolve a stored file path (e.g. "uploads/profiles/xxx.png") to a fully-qualified URL
const resolveImageUrl = (path) => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (process.env.BACKEND_URL || process.env.SERVER_URL || process.env.FRONTEND_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  return `${base}/${String(path).replace(/^\/+/, '')}`;
};

// Quick heuristic to determine if a path/URL likely points to an image.
// Accepts data:image/* URIs and common image file extensions.
const isImagePath = (path) => {
  if (!path) return false;
  const p = String(path).trim();
  // data URI for images
  if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(p)) return true;
  // strip query/hash
  const clean = p.split('?')[0].split('#')[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/.test(clean);
};

// Professional email template
const getWelcomeEmailTemplate = (userName, userEmail, defaultPassword = null) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Brazi Connect Portal</title>
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
          <div class="logo">Brazi Connect Portal</div>
          <div class="tagline">Connecting Talent with Opportunity</div>
        </div>
        
        <div class="content">
          <div class="welcome-text">
            Dear <strong>${userName}</strong>,
          </div>
          
          <p>Welcome to <strong>Brazi Connect Portal</strong>! We're thrilled to have you join our community of professionals and employers.</p>
          
          <p>Your account has been successfully created with the email: <strong>${userEmail}</strong></p>
          ${defaultPassword ? `<p>Your temporary password is: <strong>${defaultPassword}</strong></p>` : ''}
          
          <div class="features">
            <h3>🚀 What you can do now:</h3>
            <ul>
              <li><strong>Complete your profile</strong> - Add your skills, experience, and preferences and set new password</li>
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
            <div class="signature-name">The Brazi Connect Portal Team</div>
            <div class="signature-title">Customer Success Manager</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="contact-info">
            <p><strong>Brazi Connect Portal</strong></p>
            <p>📍 Kigali, Rwanda</p>
            <p>📧 info@braziconnect.rw</p>
            <p>📞 +250 789 176 625</p>
          </div>
          
          <div class="social-links">
            <a href="#">LinkedIn</a> |
            <a href="#">Twitter</a> |
            <a href="#">Facebook</a>
          </div>
          
          <p style="font-size: 12px; opacity: 0.8; margin-top: 20px;">
            © 2024 jobPortal All rights reserved.<br>
            This email was sent to ${userEmail}. If you didn't sign up for Brazi Connect Portal, please ignore this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send welcome email to newly registered user
const sendWelcomeEmail = async (userEmail, userName = 'User', defaultPassword) => {
  try {
    const mailOptions = {
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: userEmail,
      subject: 'Welcome to Brazi Connect Portal - Your Account is Ready! 🎉',
      html: getWelcomeEmailTemplate(userName, userEmail, defaultPassword)
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
const sendEmployerRequestNotification = async (employerName, employerEmail, message, phoneNumber, companyName, requestedCandidateId, adminEmail = null, priority = 'normal', loginPassword = null) => {
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

    // Helper to anonymize candidate name
    function anonymizeName(name) {
      if (!name || typeof name !== 'string') return '';
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0].charAt(0)}${'*'.repeat(parts[0].length - 1)} ${parts[1].charAt(0)}${'*'.repeat(parts[1].length - 1)}`;
      } else {
        return `${parts[0].charAt(0)}${'*'.repeat(parts[0].length - 1)}`;
      }
    }

    // Only anonymize candidate name for employer email
    let candidateInfoAnonymized = candidateInfo;
    if (candidateInfo) {
      candidateInfoAnonymized = candidateInfo.replace(/<p><strong>Name:<\/strong>\s*([^<]+)<\/p>/, (match, name) => {
        return `<p><strong>Name:</strong> ${anonymizeName(name)}</p>`;
      });
    }

    if (adminEmail && adminEmail !== employerEmail) {
      // Send to admin: New Employer Request (no anonymization)
      const adminMailOptions = {
        from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: 'New Employer Request - Brazi Connect Portal',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2c3e50;">New Employer Request</h2>
            <p>A new employer request has been submitted. Please review the details below:</p>
            
            <!-- Payment Information for Admin -->
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">💰 Payment Structure</h3>
              <p style="color: #856404; margin-bottom: 15px;"><strong>Initial Fee:</strong> 5,000 Frw (non-refundable)</p>
              <p style="color: #856404; margin-bottom: 15px;"><strong>Process:</strong> Initial payment → Additional details → Remaining payment → Connection</p>
              <p style="color: #856404; font-size: 14px;">This information has been sent to the employer in both English and Kinyarwanda.</p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Employer Name:</strong> ${employerName}</p>
              <p><strong>Employer Email:</strong> ${employerEmail}</p>
              ${phoneInfo}
              ${companyInfo}
              <p><strong>Priority:</strong> ${priority.charAt(0).toUpperCase() + priority.slice(1)}</p>
              <p><strong>Message:</strong></p>
              <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                ${message || 'No message provided'}
              </div>
              ${candidateInfo}
            </div>
            <p>Please log in to your admin dashboard to respond to this request.</p>
            <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; font-size: 12px; opacity: 0.8;">This is an automated notification from jobPortal Please do not reply to this email.</p>
            </div>
          </div>
        `
      };
      await transporter.sendMail(adminMailOptions);
    }

    // Send to employer: Request Received
    const employerMailOptions = {
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: 'Request Received - Brazi Connect Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Request Received</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your request has been received by our team.</p>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #2c3e50;">Thank You for Your Submission!</h2>
            <p>Dear ${employerName},</p>
            <p>We have received your employer request and our team will review it and get back to you within <strong>24-48 business hours</strong>.</p>
            
            <!-- Payment Information Section -->
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">💰 Payment Information</h3>
              
              <!-- English Version -->
              <div style="margin-bottom: 20px;">
                <h4 style="color: #856404; margin-bottom: 10px;">🇬🇧 English</h4>
                <p style="color: #856404; line-height: 1.6;">
                  Sir, Madam, we have gladly received the service you need from us. Before you are given full information about this worker or service, you must first pay a non-refundable fee of <strong>5,000 Frw</strong>. After that, you will be given further details, and then you can pay the remaining amount as agreed. Finally, we will connect you with the person you needed.
                </p>
              </div>
              
              <!-- Kinyarwanda Version -->
              <div style="margin-bottom: 20px;">
                <h4 style="color: #856404; margin-bottom: 10px;">🇷🇼 Kinyarwanda</h4>
                <p style="color: #856404; line-height: 1.6;">
                  Bwana, Madam twakiriye neza service mudukeneyeho, mbere yuko muhabwa amakuru ahagije kuri uyu mukozi cg service murabanza kwishyura amafranga <strong>5000 Frw</strong> adasubizwa, nyuma muhabwe undi mwirondoro mubone kwishyura asigaye bitewe nuko byumvikanweho. Bwanyuma hazabaho kubahuza nuwo mwari mukeneye.
                </p>
              </div>
              
              <div style="background-color: #fff; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7;">
                <p style="margin: 5px 0; color: #856404;"><strong>📋 Next Steps:</strong></p>
                <ol style="color: #856404; margin: 5px 0; padding-left: 20px;">
                  <li>Pay the initial fee of <strong>5,000 Frw</strong> (non-refundable)</li>
                  <li>Receive additional details about the worker/service</li>
                  <li>Pay the remaining amount as agreed</li>
                  <li>Get connected with your requested worker</li>
                </ol>
              </div>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Submitted Details:</strong></p>
              <p><strong>Email:</strong> ${employerEmail}</p>
              ${phoneInfo}
              ${companyInfo}
              <p><strong>Priority:</strong> ${priority.charAt(0).toUpperCase() + priority.slice(1)}</p>
              <p><strong>Message:</strong></p>
              <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 10px 0;">
                ${message || 'No message provided'}
              </div>
              ${candidateInfoAnonymized}
            </div>
            ${loginPassword ? `
            <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin-top: 0;">🔐 Your Login Credentials</h3>
              <p style="color: #155724; margin-bottom: 15px;"><strong>Your account has been created successfully!</strong></p>
              <div style="background-color: #fff; padding: 15px; border-radius: 5px; border: 1px solid #c3e6cb;">
                <p style="margin: 5px 0;"><strong>Email:</strong> ${employerEmail}</p>
                <p style="margin: 5px 0;"><strong>Password:</strong> <span style="font-family: monospace; background-color: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${loginPassword}</span></p>
              </div>
              <p style="color: #155724; font-size: 14px; margin-top: 15px;">
                <strong>Important:</strong> Please save these credentials. You can access your dashboard to track your request progress and manage payments.
              </p>
              <p style="color: #155724; font-size: 14px;">
                <strong>Login URL:</strong> <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/employer/login" style="color: #155724;">Click here to login</a>
              </p>
            </div>
            ` : ''}
            <p>If you have any questions, please reply to this email or contact our support team.</p>
            <div class="signature" style="border-top: 2px solid #667eea; padding-top: 20px; margin-top: 30px;">
              <p>Best regards,</p>
              <div class="signature-name" style="font-weight: bold; color: #2c3e50;">The Brazi Connect Portal Team</div>
              <div class="signature-title" style="color: #667eea; font-size: 14px;">Customer Success Manager</div>
            </div>
          </div>
          <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">This is an automated notification from jobPortal Please do not reply to this email.</p>
          </div>
        </div>
      `
    };
    const info = await transporter.sendMail(employerMailOptions);
    console.log('Employer request notification sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending employer request notification:', error);
    return false;
  }
};

// Send payment request email to employer
const sendPaymentRequestEmail = async (employerName, employerEmail, requestId, candidateName = null) => {
  try {
    const candidateInfo = candidateName ? `
      <div style="background-color: #e8f4fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Requested Worker:</strong> ${candidateName}</p>
        <p style="margin: 5px 0;"><strong>Request ID:</strong> #${requestId}</p>
      </div>
    ` : '';

    const mailOptions = {
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: employerEmail,
      subject: 'Payment Required - Brazi Connect Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Payment Required</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Initial payment needed to proceed with your request</p>
          </div>
          
          <div style="padding: 30px; background-color: #ffffff;">
            <h2 style="color: #2c3e50;">Payment Required to Continue</h2>
            <p>Dear ${employerName},</p>
            
            ${candidateInfo}
            
            <!-- Payment Information Section -->
            <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
              <h3 style="color: #856404; margin-top: 0;">💰 Payment Required</h3>
              
              <!-- English Version -->
              <div style="margin-bottom: 20px;">
                <h4 style="color: #856404; margin-bottom: 10px;">🇬🇧 English</h4>
                <p style="color: #856404; line-height: 1.6;">
                  Sir, Madam, we have gladly received the service you need from us. Before you are given full information about this worker or service, you must first pay a non-refundable fee of <strong>5,000 Frw</strong>. After that, you will be given further details, and then you can pay the remaining amount as agreed. Finally, we will connect you with the person you needed.
                </p>
              </div>
              
              <!-- Kinyarwanda Version -->
              <div style="margin-bottom: 20px;">
                <h4 style="color: #856404; margin-bottom: 10px;">🇷🇼 Kinyarwanda</h4>
                <p style="color: #856404; line-height: 1.6;">
                  Bwana, Madam twakiriye neza service mudukeneyeho, mbere yuko muhabwa amakuru ahagije kuri uyu mukozi cg service murabanza kwishyura amafranga <strong>5000 Frw</strong> adasubizwa, nyuma muhabwe undi mwirondoro mubone kwishyura asigaye bitewe nuko byumvikanweho. Bwanyuma hazabaho kubahuza nuwo mwari mukeneye.
                </p>
              </div>
            </div>
            
            <!-- Payment Instructions -->
            <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
              <h3 style="color: #155724; margin-top: 0;">📋 How to Proceed</h3>
              <ol style="color: #155724; margin: 5px 0; padding-left: 20px;">
                <li><strong>Pay the initial fee:</strong> 5,000 Frw (non-refundable)</li>
                <li><strong>Contact us:</strong> Reply to this email with your payment confirmation</li>
                <li><strong>Receive details:</strong> We'll provide additional information about the worker</li>
                <li><strong>Pay remaining amount:</strong> As agreed upon</li>
                <li><strong>Get connected:</strong> Direct connection with your requested worker</li>
              </ol>
            </div>
            
            <!-- Payment Methods -->
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2c3e50; margin-top: 0;">💳 Payment Methods</h3>
              <p>Please contact us to get the current payment details for:</p>
              <ul style="color: #2c3e50; margin: 5px 0; padding-left: 20px;">
                <li>Mobile Money (MTN, Airtel)</li>
                <li>Bank Transfer</li>
                <li>Other available methods</li>
              </ul>
            </div>
            
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border: 1px solid #ffeaa7;">
              <p style="color: #856404; margin: 5px 0; font-size: 14px;">
                <strong>⚠️ Important:</strong> This initial payment of 5,000 Frw is non-refundable and required to proceed with your request.
              </p>
            </div>
            
            <p>If you have any questions about the payment process, please reply to this email or contact our support team.</p>
            
            <div class="signature" style="border-top: 2px solid #dc3545; padding-top: 20px; margin-top: 30px;">
              <p>Best regards,</p>
              <div class="signature-name" style="font-weight: bold; color: #2c3e50;">The Brazi Connect Portal Team</div>
              <div class="signature-title" style="color: #dc3545; font-size: 14px;">Payment & Customer Success</div>
            </div>
          </div>
          
          <div style="background-color: #2c3e50; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
            <p style="margin: 0; font-size: 12px; opacity: 0.8;">This is an automated notification from jobPortal Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Payment request email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending payment request email:', error);
    return false;
  }
};

// Professional profile status change email template
const getProfileApprovalTemplate = (userName, userEmail) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Profile Approved - Brazi Connect Portal</title>
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
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
        .success-box {
          background-color: #d4edda;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
          border-left: 4px solid #28a745;
        }
        .success-box h3 {
          color: #155724;
          margin-top: 0;
        }
        .success-box ul {
          margin: 15px 0;
          padding-left: 20px;
        }
        .success-box li {
          margin-bottom: 8px;
          color: #155724;
        }
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
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
          color: #28a745;
          text-decoration: none;
          margin: 0 10px;
        }
        .signature {
          border-top: 2px solid #28a745;
          padding-top: 20px;
          margin-top: 30px;
        }
        .signature-name {
          font-weight: bold;
          color: #2c3e50;
        }
        .signature-title {
          color: #28a745;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Brazi Connect Portal</div>
          <div class="tagline">Connecting Talent with Opportunity</div>
        </div>
        
        <div class="content">
          <div class="welcome-text">
            Dear <strong>${userName}</strong>,
          </div>
          
          <p>Congratulations! 🎉 We're excited to inform you that your profile has been <strong>approved</strong> by our admin team.</p>
          
          <div class="success-box">
            <h3>✅ Your Profile is Now Active!</h3>
            <p style="color: #155724; margin-bottom: 15px;">Your profile is now publicly visible and searchable by employers. Here's what this means for you:</p>
            <ul>
              <li><strong>Employer Visibility</strong> - Your profile can now be found by potential employers</li>
              <li><strong>Job Matching</strong> - Employers can request your services directly</li>
              <li><strong>Professional Network</strong> - You're now part of our active talent pool</li>
              <li><strong>Opportunity Access</strong> - Receive notifications for relevant job opportunities</li>
            </ul>
          </div>
          
          <p>We're committed to helping you find the perfect opportunity that matches your skills and career goals.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/dashboard" class="cta-button">View Your Dashboard</a>
          </div>
          
          <div class="signature">
            <p>Best regards,</p>
            <div class="signature-name">The Brazi Connect Portal Team</div>
            <div class="signature-title">Profile Review Department</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="contact-info">
            <p><strong>Brazi Connect Portal</strong></p>
            <p>📍 Kigali, Rwanda</p>
            <p>📧 info@braziconnect.rw</p>
            <p>📞 +250 789 176 625</p>
          </div>
          
          <div class="social-links">
            <a href="#">LinkedIn</a> |
            <a href="#">Twitter</a> |
            <a href="#">Facebook</a>
          </div>
          
          <p style="font-size: 12px; opacity: 0.8; margin-top: 20px;">
            © 2024 jobPortal All rights reserved.<br>
            This email was sent to ${userEmail}. If you have any questions about your profile status, please contact us.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Professional profile rejection email template
const getProfileRejectionTemplate = (userName, userEmail, reason) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Profile Review Result - Brazi Connect Portal</title>
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
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
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
        .rejection-box {
          background-color: #f8d7da;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
          border-left: 4px solid #dc3545;
        }
        .rejection-box h3 {
          color: #721c24;
          margin-top: 0;
        }
        .improvement-box {
          background-color: #fff3cd;
          padding: 25px;
          border-radius: 8px;
          margin: 25px 0;
          border-left: 4px solid #ffc107;
        }
        .improvement-box h3 {
          color: #856404;
          margin-top: 0;
        }
        .improvement-box ul {
          margin: 15px 0;
          padding-left: 20px;
        }
        .improvement-box li {
          margin-bottom: 8px;
          color: #856404;
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
          <div class="logo">Brazi Connect Portal</div>
          <div class="tagline">Connecting Talent with Opportunity</div>
        </div>
        
        <div class="content">
          <div class="welcome-text">
            Dear <strong>${userName}</strong>,
          </div>
          
          <p>Thank you for submitting your profile to jobPortal After careful review, we need to inform you that your profile requires some improvements before it can be approved.</p>
          
          <div class="rejection-box">
            <h3>⚠️ Profile Review Result</h3>
            <p style="color: #721c24; margin-bottom: 15px;"><strong>Status:</strong> Requires Improvement</p>
            <p style="color: #721c24;"><strong>Reason:</strong> ${reason || 'Your profile needs some adjustments to meet our quality standards.'}</p>
          </div>
          
          <div class="improvement-box">
            <h3>💡 How to Improve Your Profile</h3>
            <p style="color: #856404; margin-bottom: 15px;">Here are some tips to get your profile approved:</p>
            <ul>
              <li><strong>Complete all sections</strong> - Ensure all required fields are filled out</li>
              <li><strong>Professional photo</strong> - Upload a clear, professional headshot</li>
              <li><strong>Detailed experience</strong> - Provide comprehensive work history and skills</li>
              <li><strong>Accurate information</strong> - Verify all contact details and personal information</li>
              <li><strong>Professional language</strong> - Use clear, professional language in descriptions</li>
            </ul>
          </div>
          
          <p>Don't worry - you can update your profile and resubmit it for review. Our team is here to help you succeed!</p>
          
          <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/jobseeker/profile" class="cta-button">Update Your Profile</a>
          </div>
          
          <div class="signature">
            <p>Best regards,</p>
            <div class="signature-name">The Brazi Connect Portal Team</div>
            <div class="signature-title">Profile Review Department</div>
          </div>
        </div>
        
        <div class="footer">
          <div class="contact-info">
            <p><strong>Brazi Connect Portal</strong></p>
            <p>📍 Kigali, Rwanda</p>
            <p>📧 info@braziconnect.rw</p>
            <p>📞 +250 789 176 625</p>
          </div>
          
          <div class="social-links">
            <a href="#">LinkedIn</a> |
            <a href="#">Twitter</a> |
            <a href="#">Facebook</a>
          </div>
          
          <p style="font-size: 12px; opacity: 0.8; margin-top: 20px;">
            © 2024 jobPortal All rights reserved.<br>
            This email was sent to ${userEmail}. If you have any questions about your profile review, please contact us.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const sendProfileApprovedEmail = async (toEmail, name) => {
  if (!toEmail) return false;
  try {
    await transporter.sendMail({
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Profile Approved - Welcome to Brazi Connect Portal! 🎉',
      html: getProfileApprovalTemplate(name, toEmail)
    });
    return true;
  } catch (e) { console.error('Approval email failed', e); return false; }
};

const sendProfileRejectedEmail = async (toEmail, name, reason) => {
  if (!toEmail) return false;
  try {
    await transporter.sendMail({
      from: `"Brazi Connect Portal" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      subject: 'Profile Review Result - Action Required 📝',
      html: getProfileRejectionTemplate(name, toEmail, reason)
    });
    return true;
  } catch (e) { console.error('Rejection email failed', e); return false; }
};


module.exports = {
  sendWelcomeEmail,
  sendEmployerRequestNotification,
  sendPaymentRequestEmail,
  sendProfileApprovedEmail,
  sendProfileRejectedEmail
}; 