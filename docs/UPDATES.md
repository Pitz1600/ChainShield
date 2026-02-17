# System Updates

## [2026-02-18] Security Hardening & Reliability Updates

### 🌎 Environment Consolidation
- **Single Source of Truth**: Consolidated all secrets (JWT, MongoDB, SMTP, Blockchain) into a single `.env` file at the project root.
- **Docker Integration**: Optimized `docker-compose.yml` to pull all necessary variables from the root environment and pass them to services.
- **Security Hardening**: Hardened `.gitignore` to recursively block all environment files (at any depth) from being committed to Git.
- **Redundancy Removal**: Deleted obsolete `backend/.env` and duplicate example files to prevent configuration drift.

### 🛡️ OTP Reliability & Rate Limiting
- **Backend Cooldowns**: Implemented a mandatory 60-second cooldown on all OTP resend requests to prevent spam.
- **Standardized Endpoints**: Created `/auth/resend-login-otp` for "New Device" flows, ensuring consistent behavior with account verification.
- **Frontend Timers**: Added countdown timers and auto-disabling buttons to the Login and Registration screens.
- **Middleware Security**: Updated authentication middleware to correctly handle "Onboarding" states (Verification, 2FA Setup, Password Change) while blocking general API access.

### 🐛 Bug Fixes
- **Dashboard Data**: Relaxed permissions on the Inflation Rate endpoint to allow all authenticated users (Residents/Officials) to see dashboard data (fixed 403 error).
- **Redirection Logic**: Resolved "Pending dashboard redirection" loop for both Residents (account verification) and verified devices (login OTP) by fixing endpoint mismatches and data handling.
- **Audit Logs**: Standardized logging for all sensitive authentication steps.

---

## [2026-02-18] 2FA Management & Backup Infrastructure

### 🛡️ 2FA Management (Profile)
- **Comprehensive Controls**: Users can now Enable, Change, and Disable 2FA directly from their profile page.
- **Multi-Layered Verification**: All 2FA management actions require both Password and Email OTP verification.
- **Admin Security Policy**: Implemented a mandatory 2FA policy for Administrators. Admins can Change/Reset their 2FA but cannot Disable it, ensuring persistent protection for privileged accounts.
- **Recovery Codes**: Enhanced TOTP setup flow to provide generated recovery codes upon successful activation.

### 📀 Backup Infrastructure
- **Encrypted Backups**: Fully configured `backup.sh` with AES-256-CBC encryption.
- **Secure Key Management**: Generated a 256-bit encryption key and added `BACKUP_ENCRYPTION_KEY` to the project environment.
- **Automated Retention**: Confirmed 30-day automated cleanup for old encrypted archives.

## [2026-02-17] Security Overhaul & Documentation Cleanup

### 🔒 Authentication & 2FA Enhancements
- **Fixed 2FA Key Length**: Resolved "Invalid key length" error by using a proper 64-character (32-byte) hex key for TOTP encryption.
- **Device Trust Logic**:
    - Fixed "Remember This Device" functionality.
    - Ensured untrusted devices always prompt for 2FA.
    - Bound "Remember Me" checkbox on login to backend logic.
- **Admin Onboarding**:
    - Enhanced `reset-admin.js` and `create-admin.js` to enforce password change and 2FA setup on first login.
    - Added mandatory email verification step during forced password change.
    - Improved UX for admin initial login with temporary credentials.

### 📧 Email & SMTP
- **Enforced SMTP**: Removed console logging of OTPs in development/production to prevent leakage.
- **Fixed Email Verification**: Resolved "Pending Verification" loop by fetching fresh profile from backend after successful verification.

### 📚 Documentation
- **Consolidated Security Docs**:
    - Merged `THREAT_MODEL.md`, `HARDENING_GUIDE.md`, `SMTP_SETUP.md`, `ADMIN.MD`, and `PRODUCTION_CHECKLIST.md` into a single **`docs/SECURITY.md`**.
    - Deleted redundant markdown files to clean up project root.
- **New Utility Scripts**:
    - Created `backend/reset-devices.js` to easily clear trusted devices for testing 2FA flows.

---

## [2026-02-12] Admin Script & Registration Cleanup

### 🔄 Admin Creation Process
- **Refactored `create-admin.js`**: Now uses `firstName`, `lastName`, `email`.
- **Deleted Outdated Scripts**: Removed legacy admin creation files.
- **Documentation**: Added `docs/ADMIN.MD`.

### 👤 User Registration
- Confirmed correct field usage (First/Last Name, Email).
- `username` is virtual.

### 🛡️ Security & Authentication
- **Fixed CSRF/CORS Issues**:
    - Implemented automatic CSRF token handling in `frontend/src/services/api.js`.
    - Enabled `withCredentials: true` to allow secure cookie transmission.
    - Refactored Auth components to use the centralized API service.
- **Fixed Backend Crash**: Resolved `MODULE_NOT_FOUND` via clean Docker build.
