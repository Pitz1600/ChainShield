const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  birthday: {
    type: Date,
    required: false
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  otp: {
    type: String
  },
  otpExpires: {
    type: Date
  },
  otpAttempts: {
    type: Number,
    default: 0
  },
  otpLastSentAt: {
    type: Date
  },
  inviteToken: {
    type: String
  },
  inviteExpires: {
    type: Date
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['resident', 'barangay_official', 'administrator', 'analyst', 'investigator'],
    default: 'resident'
  },
  position: String,
  isActive: {
    type: Boolean,
    default: true
  },

  // ==========================================
  // TOTP 2FA (Authenticator App)
  // ==========================================
  twoFactorSecret: {
    type: String,       // AES-256 encrypted TOTP secret
    select: false       // Never return in queries by default
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  recoveryCodes: {
    type: [String],     // bcrypt-hashed one-time recovery codes
    select: false
  },

  // ==========================================
  // Onboarding / Forced Actions
  // ==========================================
  mustChangePassword: {
    type: Boolean,
    default: false
  },
  mustSetup2FA: {
    type: Boolean,
    default: false
  },
  passwordChangedAt: {
    type: Date
  },

  // ==========================================
  // Password Reset
  // ==========================================
  resetPasswordToken: {
    type: String        // SHA-256 hashed token
  },
  resetPasswordExpires: {
    type: Date
  },

  // ==========================================
  // Email Change (dual OTP)
  // ==========================================
  pendingEmail: {
    type: String
  },
  emailChangeOtpOld: {
    type: String
  },
  emailChangeOtpNew: {
    type: String
  },
  emailChangeExpires: {
    type: Date
  }
}, { timestamps: true });

// Virtual property for backward compatibility
userSchema.virtual('username').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtuals are included when converting to JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// SECURITY: Enforce 2FA for Administrators
userSchema.pre('save', function (next) {
  if (this.role === 'administrator' && !this.twoFactorEnabled) {
    this.mustSetup2FA = true;
  }
  next();
});

// ==========================================
// TOTP Secret Encryption/Decryption
// ==========================================
const TOTP_KEY = () => {
  const key = process.env.TOTP_ENCRYPTION_KEY;
  if (!key) throw new Error('TOTP_ENCRYPTION_KEY environment variable is required');
  return Buffer.from(key, 'hex');
};

userSchema.methods.setTwoFactorSecret = function (secret) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', TOTP_KEY(), iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  this.twoFactorSecret = iv.toString('hex') + ':' + encrypted;
};

userSchema.methods.getTwoFactorSecret = function () {
  if (!this.twoFactorSecret) return null;
  const [ivHex, encrypted] = this.twoFactorSecret.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', TOTP_KEY(), Buffer.from(ivHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// ==========================================
// Recovery Codes
// ==========================================
userSchema.methods.generateRecoveryCodes = async function () {
  const codes = [];
  const hashedCodes = [];
  for (let i = 0; i < 8; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char hex codes
    codes.push(code);
    hashedCodes.push(await bcrypt.hash(code, 10));
  }
  this.recoveryCodes = hashedCodes;
  return codes; // Return plaintext codes to show user ONCE
};

userSchema.methods.useRecoveryCode = async function (code) {
  for (let i = 0; i < this.recoveryCodes.length; i++) {
    if (await bcrypt.compare(code.toUpperCase(), this.recoveryCodes[i])) {
      this.recoveryCodes.splice(i, 1); // Remove used code
      await this.save();
      return true;
    }
  }
  return false;
};

module.exports = mongoose.model('User', userSchema);