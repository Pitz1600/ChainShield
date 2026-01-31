const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
    // Removed unique: true as this is now Full Name
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
    enum: ['resident', 'barangay_official', 'administrator', 'analyst', 'investigator'], // Kept analyst/investigator for backward compatibility
    default: 'resident'
  },
  position: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);