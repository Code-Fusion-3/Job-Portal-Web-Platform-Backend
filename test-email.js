const nodemailer = require("nodemailer");

// Create transporter with your domain SMTP
const transporter = nodemailer.createTransport({
  host: "braziconnect.rw",   // SMTP server
  port: 587,                      // Secure SSL/TLS port
  secure: false,                   // true for port 465, false for 587
  auth: {
    user: "info@braziconnect.rw", // your domain email
    pass: process.env.EMAIL_PASS  // email password (better use env variable)
  },
  tls: {
    rejectUnauthorized: false // optional, sometimes needed with self-signed certs
  }
});

// Example send email
const mailOptions = {
  from: '"Brazi Connect" <info@braziconnect.rw>', 
  to: "abayosincere11@gmail.com",
  subject: "Test Email",
  text: "Hello from BraziConnect domain email!",
  html: "<b>Hello from BraziConnect domain email!</b>"
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    return console.log("Error:", error);
  }
  console.log("Message sent:", info.messageId);
});
