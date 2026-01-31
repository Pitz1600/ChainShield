const nodemailer = require('nodemailer');

/**
 * Email Service for ChainShield
 * Handles OTP and notification emails
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.isProduction = process.env.NODE_ENV === 'production';
    this.initializeTransporter();
  }

  initializeTransporter() {
    // In development, use Ethereal (fake SMTP) or console logging
    if (!this.isProduction && !process.env.SMTP_HOST) {
      console.log('📧 Email Service: Running in DEVELOPMENT mode (console logging)');
      return;
    }

    // Production or configured SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('📧 Email Service: Initialized with SMTP configuration');
  }

  /**
   * Send OTP verification email
   */
  async sendOTPEmail(email, otp, username) {
    const subject = 'ChainShield - Email Verification Code';
    const html = this.getOTPEmailTemplate(otp, username);
    const text = `Your ChainShield verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;

    return await this.sendEmail(email, subject, html, text);
  }

  /**
   * Send admin invitation email
   */
  async sendAdminInvitation(email, inviteToken, invitedBy) {
    const subject = 'ChainShield - Administrator Account Invitation';
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin-invite?token=${inviteToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ ChainShield</h1>
            <p>Administrator Invitation</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been invited by <strong>${invitedBy}</strong> to become an administrator on ChainShield.</p>
            <p>Click the button below to accept the invitation and set up your account:</p>
            <a href="${inviteUrl}" class="button">Accept Invitation</a>
            <p>Or copy this link: <br><code>${inviteUrl}</code></p>
            <p><strong>This invitation will expire in 24 hours.</strong></p>
            <p>If you didn't expect this invitation, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>ChainShield - Transaction Verification System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `You have been invited to become an administrator on ChainShield.\n\nAccept invitation: ${inviteUrl}\n\nThis invitation expires in 24 hours.`;

    return await this.sendEmail(email, subject, html, text);
  }

  /**
   * Core email sending function
   */
  async sendEmail(to, subject, html, text) {
    try {
      // Development mode: just log to console
      if (!this.transporter) {
        console.log('\n📧 ========== EMAIL (DEV MODE) ==========');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${text}`);
        console.log('📧 =====================================\n');
        return { success: true, messageId: 'dev-mode-' + Date.now() };
      }

      // Production mode: send actual email
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME || 'ChainShield'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email sent to ${to}: ${info.messageId}`);

      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('📧 Email sending failed:', error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * OTP Email HTML Template
   */
  getOTPEmailTemplate(otp, username) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
          .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ ChainShield</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <p>Hello ${username || 'there'},</p>
            <p>Thank you for registering with ChainShield. Please use the following code to verify your email address:</p>
            
            <div class="otp-box">
              <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
              <div class="otp-code">${otp}</div>
              <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 10 minutes</p>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. ChainShield staff will never ask for your verification code.
            </div>

            <p>If you didn't request this code, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>ChainShield - Transaction Verification System</p>
            <p>This is an automated message, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Export singleton instance
module.exports = new EmailService();
