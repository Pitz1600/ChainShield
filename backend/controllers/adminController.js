const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
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
        console.error('[Admin getAllUsers Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
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
            return res.status(400).json({ error: 'Request denied. Please try again.' });
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
        console.error('[Admin inviteAdmin Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
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
        const validRoles = ['resident', 'barangay_official', 'auditor', 'administrator', 'analyst'];
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
        if (role === 'administrator') {
            user._allowAdminChange = true;
        }
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
        console.error('[Admin updateUserRole Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
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
        console.error('[Admin deactivateUser Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
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
        console.error('[Admin activateUser Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

/**
 * Update user details (admin only)
 */
exports.updateUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { firstName, lastName, birthday, role, position, isActive, isVerified } = req.body;

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
        if (firstName) user.firstName = firstName;
        if (lastName) user.lastName = lastName;
        if (birthday !== undefined) user.birthday = birthday;
        if (role) {
            const validRoles = ['resident', 'barangay_official', 'auditor', 'administrator', 'analyst'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            user.role = role;
            if (role === 'administrator') {
                user._allowAdminChange = true;
            }
        }
        if (position !== undefined) user.position = position;
        if (isActive !== undefined) user.isActive = isActive;
        if (isVerified !== undefined) user.isVerified = isVerified;

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                birthday: user.birthday,
                email: user.email,
                role: user.role,
                position: user.position,
                isActive: user.isActive,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('[Admin updateUser Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
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
        console.error('[Admin getSystemStats Error]', error.message);
        res.status(500).json({ error: 'Something went wrong' });
    }
};

/**
 * Get audit logs (admin only)
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = {};

        // Filter by user (ID or name)
        if (req.query.userId) {
            query.userId = req.query.userId;
        }

        // Filter by action
        if (req.query.action) {
            query.action = req.query.action;
        }

        // Specific View: Failed attempts
        if (req.query.view === 'failed_attempts') {
            query.action = { $in: ['login_failed', 'suspicious_login'] };
        }

        // Filter by date range (days)
        if (req.query.days) {
            const days = parseInt(req.query.days);
            const date = new Date();
            date.setDate(date.getDate() - days);
            query.createdAt = { $gte: date };
        }

        // Execute query
        const logs = await AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('userId', 'username firstName lastName email role isActive lastSeenAt lastLogoutAt');

        const total = await AuditLog.countDocuments(query);

        // Map logs to match frontend expectations if necessary
        // Frontend expects: log.user (obj), log.action, log.details, log.ip, log.timestamp (or createdAt)
        const now = Date.now();
        const formattedLogs = logs.map(log => {
            const userDoc = log.userId;
            const lastSeenAt = userDoc?.lastSeenAt ? new Date(userDoc.lastSeenAt) : null;
            const lastLogoutAt = userDoc?.lastLogoutAt ? new Date(userDoc.lastLogoutAt) : null;
            const isOnline = Boolean(
                userDoc?.isActive &&
                lastSeenAt &&
                now - lastSeenAt.getTime() <= 2 * 60 * 1000 &&
                (!lastLogoutAt || lastSeenAt.getTime() > lastLogoutAt.getTime())
            );

            return ({
            _id: log._id,
            action: log.action,
            details: log.details || {},
            ip: log.ipAddress,
            timestamp: log.createdAt,
            createdAt: log.createdAt,
            isSuspicious: log.isSuspicious,
            suspiciousReason: log.suspiciousReason,
            user: userDoc ? {
                username: userDoc.username,
                email: userDoc.email,
                role: userDoc.role
            } : {
                username: log.username || 'INTERNAL SYSTEM',
                role: log.userRole || 'system'
            },
            userId: log.userId,
            userRole: log.userRole,
            userPresence: userDoc ? {
                isOnline,
                lastSeenAt,
                lastLogoutAt,
                isActive: userDoc.isActive
            } : null
            });
        });

        const users = await User.find({})
            .select('firstName lastName email role isActive lastSeenAt lastLogoutAt')
            .sort({ firstName: 1, lastName: 1 });

        const presence = users.map((u) => {
            const lastSeenAt = u.lastSeenAt ? new Date(u.lastSeenAt) : null;
            const lastLogoutAt = u.lastLogoutAt ? new Date(u.lastLogoutAt) : null;
            const isOnline = Boolean(
                u.isActive &&
                lastSeenAt &&
                now - lastSeenAt.getTime() <= 2 * 60 * 1000 &&
                (!lastLogoutAt || lastSeenAt.getTime() > lastLogoutAt.getTime())
            );
            return {
                userId: u._id,
                username: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
                email: u.email,
                role: u.role,
                isActive: u.isActive,
                isOnline,
                lastSeenAt,
                lastLogoutAt
            };
        });

        const onlineCount = presence.filter(p => p.isOnline).length;
        const offlineCount = presence.filter(p => !p.isOnline).length;

        const actionCounts = await AuditLog.aggregate([
            { $match: query },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 20 }
        ]);

        res.json({
            success: true,
            logs: formattedLogs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            summary: {
                suspiciousLast7Days: await AuditLog.countDocuments({
                    isSuspicious: true,
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }),
                onlineCount,
                offlineCount,
                totalUsers: presence.length,
                actionCounts
            },
            presence
        });
    } catch (error) {
        console.error('Get Audit Logs Error:', error);
        res.status(500).json({ error: error.message });
    }
};
/**
 * Create a new user (admin only)
 */
exports.createUser = async (req, res) => {
    try {
        const { firstName, lastName, birthday, email, password, role, position } = req.body;

        // Basic validation
        if (!firstName || !lastName || !email || !password || !role) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Restrict allowed roles for this endpoint to operational roles requested by product
        const creatableRoles = ['administrator', 'auditor', 'barangay_official', 'resident'];
        if (!creatableRoles.includes(role)) {
            return res.status(400).json({ error: 'Invalid role for user creation.' });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(email).trim())) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character.'
            });
        }

        // Check for existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Request denied. Please try again.' });
        }

        // Create user with forced onboarding
        const user = new User({
            firstName,
            lastName,
            birthday: birthday || null,
            email: String(email).trim().toLowerCase(),
            password,
            role,
            position,
            isVerified: false,
            isActive: true,
            mustChangePassword: true,
            mustSetup2FA: role === 'administrator'
        });

        // Explicitly allow administrator role assignment through this authorized admin flow
        if (role === 'administrator') {
            user._allowAdminChange = true;
        }

        await user.save();

        // Log action
        await AuditLog.create({
            action: 'admin_create_user',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            details: {
                createdUserId: user._id,
                createdUserEmail: user.email,
                role: user.role
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
};

/**
 * Delete a user (admin only)
 */
exports.deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent self-deletion
        if (userId === req.user._id.toString()) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await User.findByIdAndDelete(userId);

        // Log action
        await AuditLog.create({
            action: 'admin_delete_user',
            userId: req.user._id,
            userRole: req.user.role,
            username: req.user.username,
            details: {
                deletedUserId: userId,
                deletedUserEmail: user.email,
                deletedUserRole: user.role
            },
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
