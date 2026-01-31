# 🔄 System Updates & Changelog

This document tracks the major updates, feature enhancements, and bug fixes applied to the ChainShield system.

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
