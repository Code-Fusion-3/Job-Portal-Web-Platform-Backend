const nodemailer = require('nodemailer');

// // Create transporter with Gmail SMTP
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.GMAIL_USER,
//     pass: process.env.GMAIL_APP_PASSWORD
//   }
// });
// Create transporter with domain SMTP
const transporter = nodemailer.createTransport({
  host: "mail.braziconnect.rw",   // SMTP server
  port: 465,                      // Secure SSL/TLS port
  secure: true,                   // true for port 465, false for 587
  auth: {
    user: "info@braziconnect.rw", //  domain email
    pass: process.env.EMAIL_PASS  // email password 
  },
  tls: {
    rejectUnauthorized: false // optional, sometimes needed with self-signed certs
  }
});
// Send contact notification to admin
const sendContactNotification = async (contact, adminEmail = null) => {
    try {
      const recipientEmail = adminEmail || process.env.ADMIN_EMAIL || process.env.DOMAIN_EMAIL;
  
      const mailOptions = {
        from: `"Brazi Connect Portal Contact System" <${process.env.DOMAIN_EMAIL}>`,
        to: recipientEmail,
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
                This is an automated notification from the Brazi Connect Portal Contact System.
              </p>
            </div>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Contact notification email sent to admin:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending contact notification email to admin:', error);
      return false;
    }
  };
  
  // Send contact confirmation to sender
  const sendContactConfirmation = async (contact) => {
    try {
      const mailOptions = {
        from: `"Brazi Connect Portal Support" <${process.env.DOMAIN_EMAIL}>`,
        to: contact.email,
        subject: `Message Received: ${contact.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #27ae60; text-align: center; margin-bottom: 30px;">✅ Message Received</h1>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">Dear ${contact.name},</p>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                Thank you for contacting Brazi Connect Portal. We have successfully received your message and will get back to you as soon as possible.
              </p>
              
              <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
                <h3 style="color: #155724; margin-top: 0;">Your Message Details:</h3>
                <p><strong>Subject:</strong> ${contact.subject}</p>
                <p><strong>Category:</strong> ${contact.category}</p>
                <p><strong>Submitted:</strong> ${new Date(contact.createdAt).toLocaleString()}</p>
                <p><strong>Message ID:</strong> #${contact.id}</p>
              </div>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h4 style="color: #2c3e50; margin-top: 0;">Your Message:</h4>
                <p style="color: #7f8c8d; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${contact.message}</p>
              </div>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                Our team will review your message and respond within 24-48 hours. If you have any urgent questions, please don't hesitate to contact us again.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/contact" 
                   style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  Send Another Message
                </a>
              </div>
              
              <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
              
              <div style="text-align: center; color: #7f8c8d; font-size: 12px;">
                <p><strong>Brazi Connect Portal Support Team</strong></p>
                <p>Email: support@Brazi Connect Portal.com | Phone: +250 788 123 456</p>
                <p>© 2024 Brazi Connect Portal. All rights reserved.</p>
              </div>
            </div>
          </div>
        `
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log('Contact confirmation email sent to sender:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending contact confirmation email to sender:', error);
      return false;
    }
  };
  
  // Send contact response to user
  const sendContactResponse = async (contact) => {
    try {
      const mailOptions = {
        from: `"Brazi Connect Portal Support" <${process.env.DOMAIN_EMAIL}>`,
        to: contact.email,
        subject: `Re: ${contact.subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
            <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h1 style="color: #27ae60; text-align: center; margin-bottom: 30px;">📧 Response to Your Message</h1>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">Dear ${contact.name},</p>
              
              <p style="color: #34495e; font-size: 16px; line-height: 1.6;">
                Thank you for contacting Brazi Connect Portal. We have received your message and would like to provide you with a response.
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
                <p><strong>Brazi Connect Portal Support Team</strong></p>
                <p>Email: support@Brazi Connect Portal.com | Phone: +250 788 123 456</p>
                <p>© 2024 Brazi Connect Portal. All rights reserved.</p>
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
    sendContactNotification,
    sendContactConfirmation,
    sendContactResponse
  };