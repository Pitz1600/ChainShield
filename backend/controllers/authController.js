import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

export const register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ username, email, hashedPassword, role});
    await user.save();
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
        return res.json({ success: false, message: 'Email is required' });
    } else if (!password) {
        return res.json({ success: false, message: 'Password is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
        return res.json({ success: false, message: 'No user found with this email' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
        return res.json({ success: false, message: 'The password is incorrect' });
    }
    
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  return res.json({ success: true, message: 'Login Successful' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const sendVerifyOtp = async (req, res) => {
    try {
        const {userId} = req.body;

        const user = await userModel.findById(userId);

        if (user.isAccountVerified) {
            return res.json({ success: false, message: 'Account already verified' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.verifyOtp = otp;
        user.verifyOtpExpiry = Date.now() + 24 * 60 * 60 * 1000; // 1 day

        await user.save();

        const mailOption = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Your Verification OTP',
            text: `Hello ${user.name},\n\nYour OTP for account verification is: ${otp}\nThis OTP is valid for 24 hours.\n\nBest regards,\nThe Team`
        };

        await transporter.sendMail(mailOption);

        res.json({ success: true, message: 'Verification OTP sent to your email' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const verifyEmail = async (req, res) => {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
        return res.json({ success: false, message: 'OTP is required' });
    }

    try {
        const user = await userModel.findById(userId);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }

        if (user.verifyOtp === '' || user.verifyOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }
        if (user.verifyOtpExpiry < Date.now()) {
            return res.json({ success: false, message: 'OTP has expired' });
        }

        user.isAccountVerified = true;
        user.verifyOtp = '';
        user.verifyOtpExpiry = 0;

        await user.save();
        return res.json({ success: true, message: 'Email verified successfully' });

    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
}

export const isAuthenticated = async (req, res) => {
    try {
        return res.json({ success: true, message: 'User is authenticated' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const sendResetOtp = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ success: false, message: 'Email is required' });
    }
    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'No user found with this email' });
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));

        user.resetOtp = otp;
        user.resetOtpExpiry = Date.now() + 20 * 60 * 60 * 1000; // 20 minutes

        await user.save();

        const mailOption = {
            from: process.env.SENDER_EMAIL,
            to: user.email,
            subject: 'Password Reset OTP',
            text: `Hello ${user.name},\n\nYour OTP for password reset is: ${otp}\nThis OTP is valid for 20 minutes.\n\nBest regards,\nThe Team`
        };

        await transporter.sendMail(mailOption);

        res.json({ success: true, message: 'Password reset OTP sent to your email' });

    } catch (error) {
        res.json({ success: false, message: error.message });    
    }
}

export const verifyResetEmail = async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.json({ success: false, message: 'OTP is required' });
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'No user found with this email' });
        }

        if (user.resetOtp === '' || user.resetOtp !== otp) {
            return res.json({ success: false, message: 'Invalid OTP' });
        }
        if (user.resetOtpExpiry < Date.now()) {
            return res.json({ success: false, message: 'OTP has expired' });
        }
        
        user.resetOtp = '';
        user.resetOtpExpiry = 0;

        await user.save();
        return res.json({ success: true, message: 'OTP verified successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}

export const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.json({ success: false, message: 'Email, OTP, and new password are required' });
    }

    try {
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.json({ success: false, message: 'No user found with this email' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;

        await user.save();
        return res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}
