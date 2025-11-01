# Email Service Setup Guide

This guide explains how to configure the email service for account deletion confirmations.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Email Configuration (Gmail example)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM="MrEnglish" <your-email@gmail.com>

# Backend URL (for email links)
BACKEND_URL=https://mrenglishserverside.onrender.com
# OR
API_URL=https://mrenglishserverside.onrender.com
```

## Gmail Setup

1. **Enable 2-Step Verification** on your Google Account
2. **Generate App Password**:
   - Go to https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "MrEnglish Server" as the name
   - Copy the generated 16-character password
   - Use this password in `EMAIL_PASSWORD` (NOT your regular Gmail password)

## Alternative Email Providers

You can modify `utils/emailService.js` to use other email providers:

### SendGrid
```javascript
const transporter = nodemailer.createTransport({
  service: 'SendGrid',
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```

### Mailgun
```javascript
const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASSWORD
  }
});
```

### Custom SMTP
```javascript
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
```

## Testing

To test the email service, you can use the request deletion endpoint:

```bash
curl -X POST https://your-server.com/api/auth/request-deletion \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Check the email inbox for the deletion confirmation link.

## Troubleshooting

- **"Invalid login"**: Make sure you're using an App Password for Gmail, not your regular password
- **"Connection timeout"**: Check firewall settings and SMTP port access
- **Emails not sending**: Verify environment variables are set correctly
- **Link not working**: Ensure BACKEND_URL/API_URL is set correctly and accessible

## Security Notes

- Never commit `.env` file to version control
- Use App Passwords instead of regular passwords
- Consider using environment-specific email accounts for production
- The deletion token expires in 24 hours for security


