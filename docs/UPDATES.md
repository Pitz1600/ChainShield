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

## [2026-03-10] - UI Alignment, Real Analytics Data, and Sidebar Branding Cleanup

### Top Bar and Page Spacing
- Removed the top-right profile block from the header (`Administrator` + avatar).
- Rebalanced the top bar structure so it remains visually stable after profile removal.
- Fixed `SECURE // ENCRYPTED` badge wrapping/overflow behavior.
- Added consistent top spacing below the sticky top bar for Dashboard, Analytics, and Profile.

### Analytics (Real Data Only)
- Reworked Analytics cards and table to use backend data only from project endpoints.
- Removed hardcoded/placeholder KPI values (e.g., static accuracy/response/risk prevented values).
- Added robust fetch states:
  - loading state
  - refresh state
  - error state with retry
  - last updated timestamp
- Added severity filtering and server-backed table pagination.
- Ensured risk distribution and ratio cards are derived from live transaction/alert counts.

### Profile Tab Consistency
- Matched Profile page container rhythm with other tabs:
  - `max-width: var(--layout-max-width)`
  - aligned horizontal gutters
  - aligned hero radius, shadow, and spacing style

### Sidebar Branding
- Removed standalone sidebar logo element and leftover shape styles (square/circle artifacts).
- Kept centered text branding (`CHAINSHIELD`, `BARANGAY PORTAL`).
- Added logo back as a watermark behind brand text (instead of a separate icon block).
- Tuned watermark size and visibility based on feedback, ending at full opacity as requested.

---

## [2026-03-10] - Authentication Reliability and Auditor Posting Access

### Account Creation and Login Fixes
- Fixed account creation/login mismatch for Gmail addresses with dot variants (e.g., `first.last@gmail.com` and `firstlast@gmail.com`).
- Added centralized email normalization and lookup fallback to treat Gmail dot/alias forms consistently.
- Applied normalization to:
  - admin user creation
  - admin invitation flow
  - login
  - registration duplicate checks
  - forgot-password lookup
  - onboarding email change and secure email-change request flow
- Prevented duplicate accounts across equivalent Gmail variants.

### Admin-Provisioned Account Stability
- Hardened admin-created user flow to avoid invalid login behavior caused by inconsistent email handling.
- Kept onboarding requirements intact while ensuring created operational accounts remain usable.

### Auditor Role Capability Update
- Enabled `auditor` accounts to create community feedback posts (same post-creation capability as resident/barangay official for feedback submission).
- Updated both backend permission checks and frontend UI visibility logic for post creation actions.

---

## [2026-03-11] - Hybrid Fraud Detection, CSV Validation, UI Refinements, and Role Cleanup

### Fraud Detection Pipeline
- Implemented batch Z-score detection with risk scoring and high-risk alerting only.
- Added behavior signals (velocity, repeated receiver, amount spike) and AI integration with ML service during CSV uploads.
- Enforced high-risk blockchain recording and readable “Reason Why” output across key screens.

### CSV Integrity Rules
- CSV import now requires `agency` and `program_name` columns.
- Row-level validation blocks missing agency or program name.
- Updated the downloadable template to include required fields.

### UI/UX Improvements
- Added AI Combined/ML Score visibility in transaction modals.
- Replaced clipped risk gauge with a horizontal risk bar in transaction details and alerts.
- Improved Analytics data accuracy (live counts, staged totals), ratios, and layout alignment.
- Added overflow protection and character limits for feedbacks/replies with counters.
- Hidden “Unknown / N/A” agency/program labels when data is absent.

### Role Cleanup
- Removed `analyst` and `investigator` roles from backend and frontend role lists, permissions, and UI options.

### Reliability Fixes
- Improved trusted-device handling for 2FA to avoid unnecessary prompts after restarts.

## [2026-03-12] - UI Fixes, CSV Template Update, Manual Entry Backend Support, and Link Correction

### UI Fixes
- Fixed several UI tabs that were not displaying or switching correctly.
- Resolved multiple UI element alignment and rendering issues across the dashboard.
- Removed unnecessary details from the Auditor view.
- Added pagination to the User Sessions page for better navigation.
- Removed the online/offline indicator in the Auditor panel since it was redundant.

### CSV Template Update
- Updated the CSV template structure and formatting to ensure compatibility with the current import validation rules.

### Manual Entry Improvements
- Fixed the manual transaction entry feature.
- Manual entries now correctly communicate with the backend and follow the same validation pipeline as CSV uploads.

### Link Correction
- Fixed incorrect routing links.
- Dashboard navigation now correctly resolves to `localhost/dashboard`.