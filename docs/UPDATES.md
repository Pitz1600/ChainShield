# 🔄 System Updates & Changelog

This document tracks the major updates, feature enhancements, and bug fixes applied to the ChainShield system.

## 📅 Latest Updates (February 12, 2026)

### 🔧 Docker Environment Setup & Fixes

#### Critical Issues Resolved

##### 1. **JWT Secret Missing Error (500 Internal Server Error)**
- **Issue**: Backend threw "secretOrPrivateKey must have a value" on `/api/auth/login`
- **Root Cause**: Environment variable `JWT_SECRET` not provided to Docker Compose backend container
- **Solution**: 
  - Created root `.env` file with `JWT_SECRET=<secure-random-string>`
  - Updated `docker-compose.yml` to read from root `.env`
  - Backend container now receives JWT_SECRET on startup
- **Verification**: Login endpoint now returns 400 (validation error) instead of 500

##### 2. **Blockchain Funding Error (Insufficient Funds for Gas)**
- **Issue**: Blockchain transactions failed with "insufficient funds for gas * price + value"
- **Root Cause**: 
  - Backend was using unfunded Ganache account
  - Ganache persistent volume had zero balances from previous runs
- **Solution**:
  - Updated `.env` to use Ganache's default funded account (1000 ETH)
    - `BLOCKCHAIN_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
    - `BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
  - Reset Ganache data volume to reinitialize with fresh funded accounts
  - Verified backend has connectivity to Ganache: balance confirmed at 1000 ETH
- **Result**: Blockchain recording now succeeds for test transactions

##### 3. **ML Service Dataset Missing (PhilGEPS Prices)**
- **Issue**: ML service crashed on predictions with `FileNotFoundError: datasets/philgeps_prices.csv`
- **Root Cause**: 
  - Reference datasets not included in repository
  - ML service expected PhilGEPS market prices and PSA demographics for fraud pattern detection
- **Solution**:
  - Created minimal reference datasets:
    - `ml_service/datasets/philgeps_prices.csv` - Market prices for common procurement items
    - `ml_service/datasets/psa_demographics.csv` - Regional population/household data
  - Copied datasets into running ML container
  - Service now successfully loads reference data on initialization
- **Result**: ML prediction endpoint `/api/predict` returns valid risk scores

##### 4. **Admin User Not Created**
- **Issue**: Admin endpoint returns 404 when login attempted
- **Root Cause**: Default admin account not seeded in database
- **Solution**:
  - Created `backend/recreate-admin.js` script
  - Generates random secure password for new admin
  - Deletes existing admin and creates fresh account
  - Executed inside container: `docker compose exec backend node recreate-admin.js`
- **Result**: 
  - Email: `admin@chainshield.local`
  - Password: `22b9e95f495fa78a3c1fa8135876521f` (generated)
  - Account verified and active

#### Environment Configuration

**Root `.env` Created** (do NOT commit to git):
```env
# JWT secret (development). Replace with a secure random string in production.
JWT_SECRET=9f3b2e4d1a6c7f8e3b9d2a4f6c8e7d9f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7

# Blockchain / Contract (local Ganache)
BLOCKCHAIN_RPC_URL=http://ganache:8545
CONTRACT_ADDRESS=0x397eb49822b175d440FB1f404a9019994ee5C10F
BLOCKCHAIN_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BLOCKCHAIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Optional: Ganache mnemonic (used by docker-compose ganache service)
GANACHE_MNEMONIC=test test test test test test test test test test test junk
```

#### Files Modified/Created
- **New Files**:
  - `.env` (root - development only)
  - `backend/recreate-admin.js` - Admin account creation script
  - `ml_service/datasets/philgeps_prices.csv` - Market price reference
  - `ml_service/datasets/psa_demographics.csv` - Demographics reference

- **Modified Files**:
  - `docker-compose.yml` - Already passes `JWT_SECRET` from root `.env`
  - `.gitignore` - Already excludes `.env` files

#### Quick Start Commands

**1. Initialize the system**:
```bash
docker compose down
docker compose up -d --build
sleep 5
```

**2. Create admin account**:
```bash
docker compose exec backend node recreate-admin.js
# Output includes generated password
```

**3. Verify services**:
```bash
# Backend health
curl http://localhost:5000/health

# ML Service health
curl http://localhost:5001/health

# Blockchain status (after login with admin token)
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/blockchain/status
```

**4. Test blockchain recording**:
```bash
curl -X POST http://localhost:5000/api/blockchain/test \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Production Recommendations
- [ ] Generate a new, unique `JWT_SECRET` (min 32 characters, use: `openssl rand -hex 32`)
- [ ] Deploy smart contract to testnet/mainnet and update `CONTRACT_ADDRESS`
- [ ] Use a production Ethereum RPC (Infura, Alchemy) instead of local Ganache
- [ ] Fund production blockchain account with actual ETH
- [ ] Store private keys securely (use HashiCorp Vault, AWS Secrets Manager, etc.)
- [ ] Enable HTTPS for all external-facing endpoints
- [ ] Update ML datasets with real PhilGEPS/PSA data for production accuracy

---

## 📅 Latest Updates (February 11, 2026)

### 👤 Admin User Management Enhancements

#### 1. Account Creation
- **Admin-Created Accounts**: Administrators can now manually create user accounts.
  - *Security*: Accounts are created with `isVerified: false`.
  - *Flow*: Admins set a temporary password. Users must verify their email via OTP upon first login.
- **UI**: Added "Create User" button and modal in Admin Panel.

#### 2. User Deletion
  - *UI*: Added "Delete" button (Trash icon) with confirmation dialog.

#### 3. Audit Log Improvements
- **Visuals**: Added role-based color coding (Purple for Admins, Blue for Officials, etc.) to Audit Logs.
- **Fixes**: Resolved validation errors for "Create User" actions by updating Audit Log schema enum and ensuring `username` is correctly logged.
- **Pagination**: Reduced default page size to 10 for better readability.

### 🔒 Security Enhancements

#### Session Management
- **Token Expiry**: Reduced JWT validity from 7 days to **24 hours** to minimize risk of stolen tokens.
- **Idle Timeout**: Implemented automatic **15-minute inactivity logout**.
  - Users inactive for 15 minutes are automatically logged out and redirected to the login screen.
  - Monitors mouse movements, clicks, and keyboard activity.

#### Files Modified
- `backend/controllers/authController.js`: Reduced token expiry.
- `frontend/src/components/Auth/IdleTimer.jsx`: New component.
- `frontend/src/App.jsx`: Integrated idle timer.
- `backend/controllers/adminController.js`: Added `createUser` and `deleteUser`.

### 🎨 UI Refinements
- **Professional Icons**: Replaced playful emojis in registration forms with standard Lucide icons (Calendar, FileText, Shield) for a more professional government-grade appearance.
- `backend/models/AuditLog.js`: Updated enum list.
- `backend/routes/admin.js`: Added `POST /users` and `DELETE /users/:userId`.
- `frontend/src/components/Admin/UserManagement.jsx`: Added Create/Delete UI.
- `frontend/src/components/Admin/AuditLogViewer.jsx`: Enhanced role styling.

---

## 📅 Latest Updates (February 10, 2026)

### 🤖 Inflation-Based Anomaly Detection

#### Backend Enhancements
- **Inflation Data Service**: Created `inflationService.js` with World Bank API integration
  - Fetches Philippine inflation rate from World Bank API
  - 30-day caching mechanism for API efficiency
  - Historical inflation rate storage in MongoDB
  - Fallback to default 3.5% if API unavailable

- **Inflation Data Model**: New `InflationRate` model
  - Stores monthly inflation rates with source tracking
  - Helper methods: `getCurrentRate()`, `getRateForMonth()`
  - Supports manual rate entry by administrators

- **Enhanced Fraud Detection**: Updated `fraudDetection.js` with 4 new inflation-based features
  - `inflation_rate`: Current Philippine inflation percentage
  - `inflation_adjusted_amount`: Transaction amount normalized for inflation
  - `inflation_deviation_score`: How much the inflation-adjusted amount deviates from historical average
  - `economic_context_risk`: Combined risk score that increases tolerance during high inflation periods

- **New API Endpoints** (`/api/analytics/...`):
  - `GET /inflation/current` - Get current inflation rate
  - `GET /inflation/history?limit=12` - Get historical rates
  - `POST /inflation/manual` - Admin-only manual rate updates

#### Frontend Enhancements
- **Dashboard Inflation Display**: Added inflation rate card to hero stats
  - Green gradient design to distinguish from alert metrics
  - Displays current Philippine inflation rate with 1 decimal precision
  - Auto-fetches on dashboard load with graceful fallback

#### How It Works
The system now considers economic context when detecting anomalies:
1. Fetches latest Philippine inflation rate (monthly updates)
2. Adjusts transaction amounts for inflation: `adjusted = amount / (1 + rate/100)`
3. Compares adjusted amount against historical averages
4. **Higher inflation = More tolerance** for price variations (reduces false positives)
5. **Lower inflation = Stricter detection** (flags unusual amounts more aggressively)

#### Files Modified/Created
- **Backend**:
  - `backend/models/InflationRate.js` (NEW)
  - `backend/services/inflationService.js` (NEW)
  - `backend/routes/analytics.js` (NEW)
  - `backend/services/fraudDetection.js` (MODIFIED)
  - `backend/server.js` (MODIFIED)
- **Frontend**:
  - `frontend/src/components/Dashboard/Dashboard.jsx` (MODIFIED)

---

## 📅 Latest Updates (February 5, 2026)

### 🎨 Transactions Page UI Overhaul

#### Layout Improvements
- **Unified Hero Design**: Transactions page now matches the Admin Panel hero layout
  - Stacked vertical layout: label badge → title → description → stats row
  - 4-column glassmorphic stat cards in a single horizontal row
  - Proper left-aligned text matching reference design
  
- **Centered Page Layout**: All components now centered with `max-width: 1200px`
  - Hero section: Rounded corners with proper margins
  - Tabs: Centered to match hero width
  - Content area: Alert cards aligned with hero/tabs
  
- **Responsive Design**: Optimized for all screen sizes
  - 4-column grid on desktop
  - 2-column grid on tablets (< 1024px)
  - Single column on mobile (< 480px)

#### Files Modified
- `frontend/src/styles/TransactionsPage.css` - Complete CSS rewrite for unified layout

---

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
