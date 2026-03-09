# 🚀 ChainShield System Updates

## [2026-02-18] - Security & Automation Overhaul

### 🛡️ Security Hardening
- **MFA Flow Integrity:** Patched a critical bypass in Google OAuth that allowed users to skip 2FA setup and password changes.
- **Onboarding Session Persistence:** Resolved a major authentication blocker where temporary session tokens were missing HttpOnly browser cookies during the mandatory password change and 2FA setup steps.
- **Administrator Role Protection:** Restricted the `administrator` role to authorized system scripts only. Assigned roles can no longer be elevated to Admin via the UI or Social Login.
- **2FA Setup Fix:** Refined the admin role protection to allow legitimate security updates (like 2FA secret generation) for existing administrators while still blocking unauthorized role changes.
- **Blocked Admin SSO:** Strictly prohibited Google OAuth for administrator accounts to prevent account hijacking risks.
- **Anti-Enumeration:** Standardized all authentication error messages to "Invalid credentials" and added artificial delays to neutralize timing attacks.
- **Rate Limit Reset:** Flushed Redis caches to restore access following account lockout testing.

### 🤖 AI & Automation
- **Automated Model Retraining:** Implemented a monthly cron job (15th of the month) to trigger the ML service `/train` endpoint.
- **Internal API Security:** Secured the retraining endpoint with `X-Internal-Secret` token verification.

### 📂 Documentation Consolidation
- **Streamlined Guides:** Removed redundant files (`SETUP.md`, `UPDATES.md` (legacy), `SERVICE_HEALTH_CHECK.md`, `INFLATION_DETECTION.md`).
- **Standardization:** Renamed `DEPLOYMENT_GUIDE.md` to `deployment.md` and updated the documentation index.
- **Security Portal:** Established a formalized `/security` directory for risk assessments and audit logs.

---

## [2026-02-19] - Bug Fixes & Linux Support

### 🐛 Authentication & Onboarding Fixes
- **2FA Setup 403 Error:** Fixed authentication middleware path mismatch that blocked 2FA setup access. Updated scoped token paths from `/api/auth/setup-2fa` to `/api/auth/2fa/setup` and added path normalization for trailing slashes.
- **Logout Functionality - Two-Part Fix:**
  1. **Middleware Permission Issue:** Scoped tokens (setup_2fa, change_password, etc.) didn't have permission to call `/api/auth/logout`. Added logout endpoint to allowed paths for all scoped token types.
  2. **Response Interceptor Hijacking:** Frontend logout was calling `getProfile()` to verify token invalidation, but this 403 response triggered the interceptor to redirect back to setup pages. Removed verification call to allow clean logout without redirect interference.
  - **Result:** Users clicking "Log Out & Return" on onboarding pages now correctly log out, clear all auth state, and navigate to welcome page. After page refresh, they remain logged out.
- **Path Normalization:** Improved middleware to handle trailing slashes consistently, preventing potential path-manipulation bypasses.
- **Enhanced Debug Logging:** Added detailed debug messages showing blocked paths and allowed paths for troubleshooting.

### 🐧 Linux & Cross-Platform Support
- **Linux Shell Scripts:** Created bash equivalents for all PowerShell scripts:
  - `test-ganache.sh` - Tests Ganache blockchain connection
  - `verify-blockchain-hash.sh` - Verifies transactions on blockchain
- **Improved Portability:** Both Windows (.ps1) and Linux (.sh) versions now available with identical functionality.

### ✅ Testing & Verification
- **Path Matching Tests:** Created `test-path-matching.js` to verify middleware path validation logic.
- **Test Results:** All path matching tests pass for both scoped tokens and non-scoped onboarding flows.

---

## [2026-02-28] - Feedbacks & Communication System

### 💬 Citizen Feedback Portal
- **New Interface:** Created a dedicated `Feedbacks` page to allow residents to communicate with barangay officials and administrators.
- **Search Capabilities:** Implemented an advanced search bar capable of finding keywords across feedback content, replies, author names, and emails.
- **Role-Based Permissions:** Added strict access controls ensuring residents can only modify their own posts, while Officials and Admins maintain full CRUD capabilities across all messages.

### 📝 Edit Approval Workflow
- **Resident Edits:** Introduced an edit-approval queue where residents modifying their feedbacks or replies must have their edits verified by an official/admin before changes go live.
- **Pending States:** Developed UI indicators showing `"Edit Pending Approval"` states for feedback cards and replies.
- **Moderate Edits:** Added "Approve" and "Reject" functionality for officials and admins to moderate proposed message changes.
- **Confirmations:** Integrated custom confirmation modals for both verifying edits and permanently deleting messages.

---

## [2026-03-03] Integrity Checker (formerly CSV Import)
- **Rebranding**: Renamed the "CSV Import" module to "Integrity Checker" to better reflect its comprehensive verification capabilities.
- **Manual Transaction Entry**:
    - Introduced a new manual entry interface alongside the CSV upload functionality.
  - Developed a **Paginated Modal** that allows users to:
    - Add multiple transactions in one go.
    - Navigate between transaction rows using dynamic pagination (shown only when 2+ rows exist).
    - Remove rows if necessary.
- **Improved Layout & Validation**:
    - Refined grid layout for better scannability (Date, Payer/Payee, Debit/Credit, Description).
    - All fields are marked as **Required**.
    - Backend-ready validation ensures no incomplete data is sent for analysis.
- **Live Analysis**: Manually entered data is processed through the same AI-powered risk assessment as CSV uploads.

## Technical Changes
- Renamed components and styles from `CSVImport` to `IntegrityChecker`.
- Updated navigation shortcuts and labels in the Sidebar.
- Implemented client-side CSV generation for manual data payloads.

---

## [2026-03-09] Dashboard and Integrity Checker UI Refresh

### Admin Panel and Audit Monitoring
- Reworked the Admin Panel tabs to remove clutter and present cleaner workspace sections for user management, audit logs, and user sessions.
- Added a dedicated `User Sessions` table view with online/offline filtering, last seen tracking, and last logout visibility for quicker operational monitoring.
- Improved the Audit Logs workspace to emphasize real audit activity, session presence, and system action visibility rather than a generic placeholder log feed.
- Removed unnecessary admin navigation clutter such as the extra Community Feedback tab inside the Admin Panel flow.

### Transactions and Alerts Workspace
- Standardized the `Alerts` and `All Transactions` experience around table-based workflows to reduce visual noise from mixed card/table layouts.
- Removed redundant UI elements such as the denied filter tab and extra table/card labels where they were not adding value.
- Restored and aligned transaction moderation actions so review flows consistently expose approve, flag, deny, and delete controls where appropriate.
- Cleaned transaction detail modal layouts to improve spacing, remove broken overflow cases, and keep labels/values aligned across transaction records.

### Feedback Moderation and Permissions
- Tightened feedback permissions so administrators act as moderators rather than authors; posting is restricted to residents and barangay officials.
- Extended the moderation workflow so edited feedback content and edited replies also require approval before becoming visible.
- Preserved approval/rejection handling for both new submissions and edits, keeping moderation states explicit in the UI and backend flow.

### Dashboard Workspace
- Expanded the dashboard lower section to reduce empty space and make the page feel complete.
- Added richer monitoring panels including risk trend, risk snapshot, top agencies at risk, alert age distribution, and verification queue views.
- Improved card sizing and responsive layout behavior so the dashboard fills wide screens more consistently while still collapsing cleanly on smaller breakpoints.

### Integrity Checker Results Overhaul
- Converted detected column mappings into a structured table for easier review.
- Converted risk detection details from stacked cards into a table-style layout with clearer scanning for row, score, level, triggers, and patterns.
- Refined the checked transactions table styling, amount formatting, and text fallbacks to avoid broken symbols and inconsistent rendering.
- Added a `Clear Results` action that resets current result tables, closes the review modal, resets pagination, and clears cached local Integrity Checker results.
- Improved the review/error experience so validation failures are easier to scan and manual cleanup of imported rows is more practical.

### Error Handling UX
- Reworked the error output into a styled error table instead of a raw text dump.
- Added a scrollable error panel with sticky headers and row badges so long import validation failures remain readable.

### Risk Category Fix
- Fixed missing `Risk Category` values in Integrity Checker import results.
- Updated the multi-stage fraud pipeline to compute and return `anomalyCategory` for staged CSV/manual imports.
- Added a frontend fallback that derives a readable category from transaction type, reasons, and anomaly patterns for older cached results.

### Technical Changes
- Updated `backend/services/multiStageFraudPipeline.js` to classify anomaly categories during staged batch processing.
- Updated `backend/controllers/csvImportController.js` to include `anomalyCategory` in returned import results.
- Updated `frontend/src/components/IntegrityChecker/IntegrityChecker.jsx` and `frontend/src/styles/IntegrityChecker.css` for the new table layouts, clear-results action, and polished error presentation.
- Updated `frontend/src/components/Dashboard/Dashboard.jsx` and `frontend/src/styles/Dashboard.css` to support the expanded dashboard analytics panels and responsive card layout.
- Updated admin, feedback, audit, transactions, and session-management views to match the cleaner table-first moderation workflow introduced during the March UI pass.
