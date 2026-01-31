const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService');

/**
 * Admin Controller
 * Handles administrative functions like user management
 */

/**
 * Get all users (admin only)
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select('-password -otp -otpExpires')
            .sort({ createdAt: -1 });

        // Add fallback timestamps from ObjectId if missing
        const usersWithDates = users.map(user => {
            const u = user.toObject();
            if (!u.createdAt) u.createdAt = user._id.getTimestamp();
            if (!u.updatedAt) u.updatedAt = user._id.getTimestamp();
            return u;
        });

        res.json({
            success: true,
            count: usersWithDates.length,
            users: usersWithDates
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Create admin invitation (admin only)
 */
exports.inviteAdmin = async (req, res) => {
    try {
        const { email, username } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Generate secure invitation token
        const inviteToken = crypto.randomBytes(32).toString('hex');
        const inviteExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Create pending admin user
        const user = new User({
            username,
            email,
            password: crypto.randomBytes(32).toString('hex'), // Temporary random password
            role: 'administrator',
            isVerified: false,
            isActive: false, // Inactive until they complete setup
            inviteToken,
            inviteExpires,
            invitedBy: req.user.id
        });

        await user.save();

        // Send invitation email
        try {
            await emailService.sendAdminInvitation(email, inviteToken, req.user.username);

            res.status(201).json({
                success: true,
                message: 'Admin invitation sent successfully',
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                }
            });
        } catch (emailError) {
            // Rollback user creation if email fails
            await User.findByIdAndDelete(user._id);
            throw new Error('Failed to send invitation email');
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update user role (admin only)
 */
exports.updateUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        // Validate role
        const validRoles = ['resident', 'barangay_official', 'administrator'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        // Prevent self-demotion
        if (userId === req.user.id && role !== 'administrator') {
            return res.status(400).json({ error: 'You cannot change your own role' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.role = role;
        await user.save();

        res.json({
            success: true,
            message: 'User role updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Deactivate user (admin only)
 */
exports.deactivateUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent self-deactivation
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'You cannot deactivate your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isActive = false;
        await user.save();

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Activate user (admin only)
 */
exports.activateUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.isActive = true;
        await user.save();

        res.json({
            success: true,
            message: 'User activated successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Update user details (admin only)
 */
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, role, position, isActive, isVerified } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent self-role/status change safety checks
        if (userId === req.user.id) {
            if (role && role !== 'administrator') {
                return res.status(400).json({ error: 'You cannot change your own role' });
            }
            if (isActive === false) {
                return res.status(400).json({ error: 'You cannot deactivate your own account' });
            }
        }

        // Update fields if provided
        if (username) user.username = username;
        if (role) user.role = role;
        if (position !== undefined) user.position = position;
        if (isActive !== undefined) user.isActive = isActive;
        if (isVerified !== undefined) user.isVerified = isVerified;

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                position: user.position,
                isActive: user.isActive,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get system statistics (admin only)
 */
exports.getSystemStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeUsers = await User.countDocuments({ isActive: true });
        const verifiedUsers = await User.countDocuments({ isVerified: true });
        const pendingVerification = await User.countDocuments({ isVerified: false });

        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            stats: {
                totalUsers,
                activeUsers,
                verifiedUsers,
                pendingVerification,
                usersByRole: usersByRole.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {})
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
