# 📡 ChainShield API Documentation

## Base URL

```
Development: http://localhost:5000/api
Production:  https://your-domain.com/api
```

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:
```
Authorization: Bearer <jwt_token>
```

All mutating requests (POST, PUT, DELETE, PATCH) require a CSRF token:
```
X-CSRF-Token: <csrf_token>
```

### Get CSRF Token
```
GET /csrf-token
Response: { "csrfToken": "..." }
```

---

## Auth Endpoints

### Register
```
POST /auth/register
Rate Limit: 10/hour
Body: { firstName, lastName, email, password, role, birthday?, position? }
Response 201: { token, user: { id, firstName, lastName, email, role, isVerified } }
```

**Password Policy**: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
**Allowed Roles**: `resident`, `barangay_official`

### Login
```
POST /auth/login
Rate Limit: 20/15min
Body: { email, password }
Response 200 (admin): { token, user: {...} }
Response 200 (others): { otpRequired: true, userId, message }
```

### Verify Login OTP
```
POST /auth/verify-login-otp
Rate Limit: 20/15min
Body: { userId, otp }
Response 200: { token, user: {...} }
```

### Logout
```
POST /auth/logout
Auth: Required
Response 200: { success: true, message }
```

### Get Profile
```
GET /auth/profile
Auth: Required
Response 200: { id, firstName, lastName, email, role, ... }
```

### Verify Email
```
POST /auth/verify-email
Auth: Required
Rate Limit: 10/10min
Body: { otp }
Response 200: { success: true, message }
```

### Resend OTP
```
POST /auth/resend-otp
Auth: Required
Rate Limit: 10/hour
Response 200: { success: true, message }
```

### Update Profile (OTP-protected)
```
POST /auth/send-profile-otp  → sends OTP
PUT  /auth/update-profile     → { firstName, lastName, birthday, email, otp }
```

### Change Password (OTP-protected)
```
POST /auth/send-password-otp  → sends OTP
POST /auth/change-password    → { currentPassword, newPassword, otp }
```

---

## Transaction Endpoints

### List Transactions
```
GET /transactions
Auth: Required
Query: page, limit, sort, search, riskLevel, flagged
Response 200: { transactions: [...], pagination: {...} }
```

### Get Transaction
```
GET /transactions/:id
Auth: Required
Response 200: { transaction object }
```

### Import CSV
```
POST /transactions/import
Auth: Required (Official or Admin)
Content-Type: multipart/form-data
Body: csvFile (file, .csv only, max 10MB)
Response 200: { success, imported, failed, flaggedCount, results: [...] }
```

### Download Template
```
GET /transactions/template
Auth: Required
Response: CSV file download
```

---

## Admin Endpoints

All admin endpoints require `administrator` role.

### List Users
```
GET /admin/users
Response 200: { success, count, users: [...] }
```

### Create User
```
POST /admin/users
Body: { firstName, lastName, email, password, role, position?, birthday? }
Response 201: { success, user }
```

### Update User
```
PUT /admin/users/:userId
Body: { firstName?, lastName?, role?, position?, isActive?, isVerified?, birthday? }
Response 200: { success, user }
```

### Delete User
```
DELETE /admin/users/:userId
Response 200: { success, message }
```

### Deactivate/Activate User
```
PUT /admin/users/:userId/deactivate
PUT /admin/users/:userId/activate
Response 200: { success, message }
```

### Get Audit Logs
```
GET /admin/audit-logs
Query: page, limit, action, suspicious, days
Response 200: { logs: [...], pagination: {...}, summary: {...} }
```

### System Stats
```
GET /admin/stats
Response 200: { stats: { totalUsers, activeUsers, ... } }
```

---

## Blockchain Endpoints

### Get Status
```
GET /blockchain/status
Auth: Required
Response 200: { connected, networkId, blockNumber }
```

### Verify Transaction
```
POST /blockchain/verify
Auth: Required
Body: { txHash }
Response 200: { verified, details }
```

---

## Complaint Endpoints

### Submit Complaint
```
POST /complaints
Auth: Required
Content-Type: multipart/form-data
Body: { category, subject, description, attachments[]? }
Response 201: { success, complaintId }
```

### List Complaints
```
GET /complaints/my-complaints
Auth: Required
Response 200: { complaints: [...] }
```

---

## Error Responses

All errors follow a consistent format:
```json
{
  "error": "Human-readable error message"
}
```

| Code | Meaning |
|---|---|
| 400 | Validation error or bad request |
| 401 | Not authenticated or token invalid |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

*Last Updated: 2026-02-17*
