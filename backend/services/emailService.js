const nodemailer = require('nodemailer');

/**
 * Email Service for ChainShield
 * Handles OTP, 2FA, password reset, and notification emails
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.isProduction = process.env.NODE_ENV === 'production';
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!this.isProduction && !process.env.SMTP_HOST) {
      // SMTP Enforcement: Do NOT log to console. 
      // If SMTP is missing, this will likely cause errors downstream, which is intended.
      console.warn('⚠️  Email Service: SMTP_HOST not set. Emails will fail to send.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    console.log('📧 Email Service: Initialized with SMTP configuration');
  }

  // ==========================================
  // CORE SEND
  // ==========================================
  async sendEmail(to, subject, html, text) {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('\n📧 ========== EMAIL (DEV MODE LOGGING) ==========');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${text}`);
        console.log('📧 =================================================\n');
      }

      if (!this.transporter) {
        return { success: true, messageId: 'dev-mode-' + Date.now() };
      }

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

  // ==========================================
  // OTP EMAILS
  // ==========================================
  async sendOTPEmail(email, otp, username) {
    const subject = 'ChainShield - Email Verification Code';
    const html = this._wrapTemplate('Email Verification', `
      <p>Hello ${username || 'there'},</p>
      <p>Please use the following code to verify your email address:</p>
      ${this._otpBox(otp)}
      ${this._securityNotice()}
      <p>If you didn't request this code, please ignore this email or contact support.</p>
    `);
    const text = `Your ChainShield verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.`;
    return await this.sendEmail(email, subject, html, text);
  }

  async sendEmailChangeOTP(email, otp, isOldEmail) {
    const label = isOldEmail ? 'current' : 'new';
    const subject = `ChainShield - Email Change Verification (${label} email)`;
    const html = this._wrapTemplate('Email Change Verification', `
      <p>Hello,</p>
      <p>An email change was requested for your ChainShield account. This code was sent to your <strong>${label}</strong> email address.</p>
      ${this._otpBox(otp)}
      <p>Both the old and new email must be verified to complete the change.</p>
      ${this._securityNotice()}
    `);
    const text = `Your ChainShield email change verification code (${label} email) is: ${otp}\n\nThis code will expire in 15 minutes.`;
    return await this.sendEmail(email, subject, html, text);
  }

  // ==========================================
  // PASSWORD EMAILS
  // ==========================================
  async sendPasswordResetEmail(email, resetUrl, username) {
    const subject = 'ChainShield - Password Reset Request';
    const html = this._wrapTemplate('Password Reset', `
      <p>Hello ${username || 'there'},</p>
      <p>We received a request to reset your password. Click the button below to set a new password:</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Reset Password</a>
      </div>
      <p style="color: #666; font-size: 13px;">Or copy this link: <br><code style="word-break: break-all;">${resetUrl}</code></p>
      <div style="background: #fee; border-left: 4px solid #e74c3c; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <strong>⏰ This link expires in 15 minutes.</strong>
      </div>
      ${this._securityNotice()}
    `);
    const text = `Password Reset Request\n\nClick this link to reset your password: ${resetUrl}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, ignore this email.`;
    return await this.sendEmail(email, subject, html, text);
  }

  async sendPasswordChangedNotification(email, username) {
    const subject = 'ChainShield - Password Changed Successfully';
    const html = this._wrapTemplate('Password Changed', `
      <p>Hello ${username || 'there'},</p>
      <p>Your ChainShield account password was successfully changed.</p>
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ If you did not make this change</strong>, your account may be compromised. Please immediately:
        <ul>
          <li>Reset your password using the forgot password feature</li>
          <li>Contact support if you cannot access your account</li>
        </ul>
      </div>
      <p style="color: #666; font-size: 13px;">Time: ${new Date().toISOString()}</p>
    `);
    const text = `Your ChainShield password was changed. If you did not do this, please reset your password immediately.`;
    return await this.sendEmail(email, subject, html, text);
  }

  // ==========================================
  // DEVICE ALERT
  // ==========================================
  async sendNewDeviceAlert(email, deviceInfo, username) {
    const subject = 'ChainShield - New Device Login Detected';
    const html = this._wrapTemplate('New Device Detected', `
      <p>Hello ${username || 'there'},</p>
      <p>A login was detected from a new device or location:</p>
      <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Device:</strong> ${deviceInfo.label || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>IP Address:</strong> ${deviceInfo.ip || 'Unknown'}</p>
        <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toISOString()}</p>
      </div>
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ If this wasn't you</strong>, please change your password immediately and review your account security settings.
      </div>
    `);
    const text = `New device login detected on your ChainShield account.\n\nDevice: ${deviceInfo.label}\nIP: ${deviceInfo.ip}\nTime: ${new Date().toISOString()}\n\nIf this wasn't you, change your password immediately.`;
    return await this.sendEmail(email, subject, html, text);
  }

  // ==========================================
  // ADMIN INVITATION
  // ==========================================
  async sendAdminInvitation(email, inviteToken, invitedBy) {
    const subject = 'ChainShield - Administrator Account Invitation';
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin-invite?token=${inviteToken}`;
    const html = this._wrapTemplate('Administrator Invitation', `
      <p>Hello,</p>
      <p>You have been invited by <strong>${invitedBy}</strong> to become an administrator on ChainShield.</p>
      <div style="text-align: center; margin: 25px 0;">
        <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept Invitation</a>
      </div>
      <p style="color: #666; font-size: 13px;">Or copy this link: <br><code>${inviteUrl}</code></p>
      <p><strong>This invitation will expire in 24 hours.</strong></p>
    `);
    const text = `You have been invited to become an administrator on ChainShield.\n\nAccept invitation: ${inviteUrl}\n\nThis invitation expires in 24 hours.`;
    return await this.sendEmail(email, subject, html, text);
  }

  // ==========================================
  // TEMP PASSWORD EMAIL
  // ==========================================
  async sendTempPasswordEmail(email, tempPassword, username) {
    const subject = 'ChainShield - Your Temporary Account Password';
    const html = this._wrapTemplate('Account Created', `
      <p>Hello ${username || 'there'},</p>
      <p>An account has been created for you on ChainShield. Use the following temporary password to log in:</p>
      <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #666; font-size: 14px;">Temporary Password</p>
        <div style="font-size: 22px; font-weight: bold; color: #667eea; letter-spacing: 2px; font-family: 'Courier New', monospace; margin-top: 10px;">${tempPassword}</div>
      </div>
      <div style="background: #fee; border-left: 4px solid #e74c3c; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <strong>🔒 You will be required to change this password and set up two-factor authentication on your first login.</strong>
      </div>
    `);
    const text = `An account has been created for you on ChainShield.\n\nTemporary password: ${tempPassword}\n\nYou MUST change this password on first login.`;
    return await this.sendEmail(email, subject, html, text);
  }

  // ==========================================
  // TEMPLATE HELPERS
  // ==========================================
  _wrapTemplate(title, bodyContent) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛡️ ChainShield</h1>
            <p>${title}</p>
          </div>
          <div class="content">
            ${bodyContent}
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

  _otpBox(otp) {
    return `
      <div style="background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
        <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
        <div style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</div>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 12px;">Valid for 10 minutes</p>
      </div>
    `;
  }

  _securityNotice() {
    return `
      <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; border-radius: 4px;">
        <strong>⚠️ Security Notice:</strong> Never share this code with anyone. ChainShield staff will never ask for your verification code.
      </div>
    `;
  }
}

// Export singleton instance
module.exports = new EmailService();
