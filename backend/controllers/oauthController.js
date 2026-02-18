/**
 * OAuth Controller — Google SSO
 * Handles Google OAuth 2.0 callback, user provisioning, and session issuance.
 *
 * Flow:
 *   1. User clicks "Continue with Google" → GET /api/auth/google
 *   2. Passport redirects to Google consent screen
 *   3. Google redirects back → GET /api/auth/google/callback
 *   4. This controller finds/creates the user, issues JWT cookie, redirects to frontend
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const TrustedDevice = require('../models/TrustedDevice');
const jwt = require('jsonwebtoken');

// ==========================================
// GOOGLE OAUTH CALLBACK
// ==========================================
exports.googleCallback = async (req, res) => {
    try {
        const profile = req.oauthProfile; // set by passport strategy in server.js

        if (!profile) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_failed`);
        }

        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const firstName = profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User';
        const lastName = profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '';

        if (!email) {
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_no_email`);
        }

        let user = await User.findOne({ $or: [{ googleId }, { email }] });

        // SECURITY: Strictly block OAuth for administrator accounts — they MUST use local auth + TOTP
        // This prevents unauthorized hijacking or accidental merging of admin accounts.
        if (user && user.role === 'administrator') {
            console.warn(`[SECURITY] Blocked OAuth attempt for administrator account: ${email}`);
            return res.redirect(
                `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_admin_blocked`
            );
        }

        if (user) {
            // Existing user — link Google ID if not already linked
            if (!user.googleId) {
                user.googleId = googleId;
                user.authProvider = user.authProvider || 'local'; // keep 'local' if they had a password
                await user.save();
            }

            if (!user.isActive) {
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=account_disabled`);
            }
        } else {
            // New user — provision account via Google
            user = new User({
                firstName,
                lastName,
                email,
                googleId,
                authProvider: 'google',
                role: 'resident', // OAuth users always start as residents
                isVerified: true, // Google already verified the email
                isActive: true,
                // No password — OAuth users authenticate via Google
                password: `oauth_${googleId}_${Date.now()}`, // placeholder, never used for auth
                mustChangePassword: false,
                mustSetup2FA: false,
            });
            await user.save();
        }

        // CHECK 2FA: If enabled and device not trusted, enforce TOTP
        const userAgent = req.get('User-Agent') || 'unknown';
        const clientIp = req.ip;
        const isTrusted = await TrustedDevice.isDeviceTrusted(user._id, userAgent, clientIp);

        // 1. Enforce Password Change if required (usually for linked local accounts that were reset)
        if (user.mustChangePassword) {
            const onboardingToken = jwt.sign(
                { id: user._id, scope: 'change_password' },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            res.cookie('token', onboardingToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 15 * 60 * 1000,
                path: '/'
            });
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?oauth_force_password=true`);
        }

        // 2. Enforce 2FA Verification
        if (user.twoFactorEnabled && !isTrusted) {
            // Issue a temporary token that only allows MFA verification
            const mfaToken = jwt.sign(
                { id: user._id, scope: 'mfa_verification' },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );

            res.cookie('token', mfaToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 15 * 60 * 1000, // 15 minutes
                path: '/'
            });

            return res.redirect(
                `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?oauth_mfa=true&userId=${user._id}`
            );
        }

        // 3. Enforce 2FA Setup
        if (user.mustSetup2FA) {
            const onboardingToken = jwt.sign(
                { id: user._id, scope: 'setup_2fa' },
                process.env.JWT_SECRET,
                { expiresIn: '15m' }
            );
            res.cookie('token', onboardingToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
                maxAge: 15 * 60 * 1000,
                path: '/'
            });
            return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?oauth_setup_2fa=true`);
        }

        // Issue full JWT session cookie
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/'
        });

        await AuditLog.logAction({
            action: 'oauth_login',
            userId: user._id,
            userRole: user.role,
            username: user.email,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            details: { provider: 'google', email },
        });

        // Redirect to frontend — the app will call /api/auth/profile to get user data
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?oauth=success`);
    } catch (error) {
        console.error('[OAuth Callback Error]', error.message);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_error`);
    }
};
