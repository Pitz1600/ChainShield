# System Updates

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
    - Merged `THREAT_MODEL.md`, `HARDENING_GUIDE.md`, `SMTP_SETUP.md`, `ADMIN.MD`, and `PRODUCTION_CHECKLIST.md` into a single **`SECURITY.md`**.
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
