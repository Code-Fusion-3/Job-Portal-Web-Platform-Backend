require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('🧪 Testing email configuration...');

// Check environment variables
console.log('Environment variables:');
console.log(`GMAIL_USER: ${process.env.GMAIL_USER ? 'Set' : 'NOT SET'}`);
console.log(`GMAIL_APP_PASSWORD: ${process.env.GMAIL_APP_PASSWORD ? 'Set' : 'NOT SET'}`);

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.error('❌ Email configuration is missing!');
  console.error('Please set GMAIL_USER and GMAIL_APP_PASSWORD environment variables');
  process.exit(1);
}

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// Test email sending
async function testEmail() {
  try {
    console.log('📧 Testing email sending...');
    
    const mailOptions = {
      from: `"Job Portal Test" <${process.env.GMAIL_USER}>`,
      to: 'abayosincere11@gmail.com', // Test email
      subject: 'Test Email - Job Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">Test Email</h2>
          <p>This is a test email to verify the email configuration is working.</p>
          <p>Time: ${new Date().toISOString()}</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('❌ Test email failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      command: error.command
    });
  }
}

testEmail(); 