# System Updates

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
