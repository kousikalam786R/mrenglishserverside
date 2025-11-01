const nodemailer = require('nodemailer');

// Create transporter (configure based on your email provider)
const createTransporter = () => {
  // Using Gmail SMTP as default - you can change this to your preferred email service
  // For production, use environment variables for credentials
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'your-app-password', // Use App Password, not regular password
    },
  });
};

// Send account deletion confirmation email
const sendDeletionEmail = async (email, name, deletionToken) => {
  try {
    const transporter = createTransporter();
    
    // Use backend API URL for the deletion confirmation
    const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'https://mrenglishserverside.onrender.com';
    const deletionLink = `${backendUrl}/api/auth/confirm-deletion?token=${deletionToken}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"MrEnglish" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Confirm Account Deletion - MrEnglish',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333333;
              background-color: #f5f5f5;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background-color: #D64545;
              color: #ffffff;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .content {
              padding: 40px 30px;
            }
            .warning-box {
              background-color: #FCEAEA;
              border-left: 4px solid #D64545;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .warning-box p {
              margin: 0;
              color: #B3261E;
              font-weight: 600;
            }
            .button {
              display: inline-block;
              padding: 16px 32px;
              background-color: #D64545;
              color: #ffffff;
              text-decoration: none;
              border-radius: 28px;
              font-weight: 600;
              margin: 20px 0;
              text-align: center;
            }
            .button:hover {
              background-color: #B3261E;
            }
            .link {
              word-break: break-all;
              color: #4A90E2;
              text-decoration: none;
            }
            .footer {
              background-color: #F5F5F5;
              padding: 20px 30px;
              text-align: center;
              color: #666666;
              font-size: 13px;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Account Deletion Request</h1>
            </div>
            <div class="content">
              <p>Hello ${name || 'User'},</p>
              <p>We received a request to delete your MrEnglish account.</p>
              
              <div class="warning-box">
                <p>⚠️ Warning: This action cannot be undone. All your data, conversations, stats, and preferences will be permanently removed.</p>
              </div>
              
              <p>If you initiated this request, please click the button below to confirm the deletion:</p>
              
              <div style="text-align: center;">
                <a href="${deletionLink}" class="button">Delete My Account</a>
              </div>
              
              <p style="margin-top: 30px; font-size: 13px; color: #666666;">
                Or copy and paste this link into your browser:<br>
                <a href="${deletionLink}" class="link">${deletionLink}</a>
              </p>
              
              <p style="margin-top: 30px; font-size: 13px; color: #666666;">
                <strong>Important:</strong> This link will expire in 24 hours. If you didn't request to delete your account, please ignore this email or contact our support team immediately.
              </p>
            </div>
            <div class="footer">
              <p><strong>MrEnglish Team</strong></p>
              <p>If you need assistance, contact us at support@mrenglish.app</p>
              <p style="margin-top: 15px; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Account Deletion Request - MrEnglish
        
        Hello ${name || 'User'},
        
        We received a request to delete your MrEnglish account.
        
        ⚠️ WARNING: This action cannot be undone. All your data, conversations, stats, and preferences will be permanently removed.
        
        If you initiated this request, please click the link below to confirm the deletion:
        
        ${deletionLink}
        
        This link will expire in 24 hours. If you didn't request to delete your account, please ignore this email or contact our support team immediately.
        
        ---
        MrEnglish Team
        Support: support@mrenglish.app
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Deletion email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending deletion email:', error);
    throw error;
  }
};

// Send confirmation email after account deletion
const sendDeletionConfirmationEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || `"MrEnglish" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Account Deleted - MrEnglish',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333333;
              background-color: #f5f5f5;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background-color: #4A4A62;
              color: #ffffff;
              padding: 30px 20px;
              text-align: center;
            }
            .content {
              padding: 40px 30px;
            }
            .footer {
              background-color: #F5F5F5;
              padding: 20px 30px;
              text-align: center;
              color: #666666;
              font-size: 13px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Account Deleted</h1>
            </div>
            <div class="content">
              <p>Hello ${name || 'User'},</p>
              <p>Your MrEnglish account has been successfully deleted.</p>
              <p>All your data, conversations, statistics, and preferences have been permanently removed from our system.</p>
              <p>We're sorry to see you go! If you change your mind, you can always create a new account in the future.</p>
              <p style="margin-top: 30px;">Best regards,<br><strong>The MrEnglish Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log('Deletion confirmation email sent to:', email);
    return { success: true };
  } catch (error) {
    console.error('Error sending deletion confirmation email:', error);
    // Don't throw - deletion already happened
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendDeletionEmail,
  sendDeletionConfirmationEmail,
};

