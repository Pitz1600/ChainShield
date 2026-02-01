# 🔄 System Updates & Changelog

This document tracks the major updates, feature enhancements, and bug fixes applied to the ChainShield system.

## 📅 Latest Updates (February 1, 2026 - Evening)

### 🔐 Rate Limiting & OTP System Overhaul

#### Backend Improvements

**Rate Limiting Enhancements**
- **Increased all rate limits** for better user experience:
  - Login: 5 → **20 attempts** per 15 minutes
  - OTP Verification: 3 → **10 attempts** per 10 minutes
  - OTP Resend: 3 → **10 resends** per hour
  - Registration: 3 → **10 registrations** per hour
  - General API: 500 → **5000 requests** per 15 minutes
  - Strict Operations: 10 → **50 requests** per hour
- **Fixed page refresh rate limiting** - Added `skipSuccessfulRequests: true` to general API limiter
  - Only failed/error requests count toward the limit
  - Users can now refresh the page unlimited times without hitting rate limits
  - Maintains security against actual abuse

**OTP System Improvements**
- **Increased OTP attempts** from 3 to 10 before requiring new OTP
- **Added new OTP-protected endpoints**:
  - `POST /auth/send-profile-otp` - Send OTP for profile updates
  - `PUT /auth/update-profile` - Update profile with OTP verification
  - `POST /auth/send-password-otp` - Send OTP for password changes
  - `POST /auth/change-password` - Change password with OTP verification
- All endpoints include comprehensive security:
  - 10-minute OTP expiration
  - Maximum 10 failed attempts
  - Rate limiting protection
  - Email uniqueness validation

#### Frontend Improvements

**Profile Page UI Overhaul**
- **Converted OTP forms to modal popups** for better UX:
  - Edit Profile modal with OTP verification
  - Change Password modal with OTP verification
- **Modal features**:
  - Smooth fade-in and slide-up animations
  - Backdrop blur effect for focus
  - Click outside or X button to close
  - Fully responsive design
  - Clean, modern interface

**Files Modified:**
- `backend/middleware/rateLimiter.js` - Updated all rate limits
- `backend/controllers/authController.js` - Added 4 new OTP endpoints, increased attempt limits
- `backend/routes/auth.js` - Added routes for new endpoints
- `frontend/src/components/Profile/Profile.jsx` - Converted to modal-based UI
- `frontend/src/styles/Profile.css` - Added modal styles and animations

---

## 📅 Latest Updates (February 1, 2026)

### 🚀 New Features

#### 1. Digital Services Module
*   **Secure Submission Module**: Users can now submit secure forms with categories, descriptions, and file attachments.
    *   *Endpoint*: `POST /api/submissions`
*   **External Verification**: Feature added to verify data against external government portals.
    *   *Endpoint*: `POST /api/external/scan`
*   **Mobile-Responsive Sidebar**: Navigation now works seamlessly on mobile devices.

#### 2. Enhanced User Management (Admin Panel)
*   **Full Edit Capability**: Administrators can now edit user details via a modal.
    *   **Editable Fields**: Username, Role, Official Position, Active Status, Verification Status.
    *   **Security**: Email and Password fields are read-only to prevent unauthorized takeovers.
*   **Standardized Roles**: "Barangay Official" positions are now a dropdown menu (Captain, Kagawad, Secretary, Treasurer, SK Chairperson) to ensure data consistency.

#### 3. Transaction Monitoring
*   **Modernized UI**: Replaced generic tables with clean, card-based layouts for better readability.
*   **Fraud Detection**: Integrated real-time risk scoring and "Flagged" status indicators.

### 🎨 UI/UX Improvements

*   **Global Design System**: Unified the look and feel across all pages.
    *   Replaced all emojis with professional `lucide-react` icons.
    *   Implemented consistent "Hero Banners" for page titles.
    *   Standardized color palettes (Blue/Green/Orange status badges).
*   **Admin Dashboard**: Redesigned statistics cards with gradient backgrounds for better visual hierarchy.
*   **Responsive Layouts**: Fixed CSS issues where tables would break on smaller screens.

### 🐛 Bug Fixes

*   **Date Display**: Fixed the "Account Created: N/A" issue.
    *   *Fix*: The system now accurately calculates the "Joined" date from the user's unique ID (MongoDB ObjectId) if the explicit timestamp is missing. This retroactively fixed all existing accounts.
*   **Crash Fixes**: Resolved React rendering errors (e.g., "Adjacent JSX elements") in the Admin Panel.
*   **Layout Fixes**: Corrected CSS media queries that were causing the Admin user list to look broken on desktop screens.

### 🧹 Project Cleanup

*   **File Organization**:
    *   Moved `SETUP.md` and `ADMIN_SETUP.md` to the `docs/` folder.
    *   Deleted unused root files (`sample_transactions.csv`, `package-lock.json`).
*   **Documentation**: Updated `README.md` to reflect the specific "Barangay Integrity System" use case.

### 📉 Feature Deprecation

*   **Flagged Cases Removal**:
    *   **Reason**: Feature deemed redundant and replaced by improved Transaction Monitoring and Alerts.
    *   **Action**: Completely removed the "Flagged Cases" module.
        *   Deleted `Cases.jsx` and styling.
        *   Removed `Case` model and backend routes.
        *   Cleaned up Sidebar navigation and permissions.

---

## 🔮 Future Roadmap

*   **Email Notifications**: Enable real SMTP sending for complaint updates (currently simulated).
*   **Blockchain Explorer**: Add a dedicated view to inspect raw blockchain transaction hashes.
