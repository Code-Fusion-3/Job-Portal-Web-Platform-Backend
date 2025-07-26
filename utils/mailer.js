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

module.exports = {
  sendWelcomeEmail
}; 