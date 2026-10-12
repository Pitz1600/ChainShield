# PLAN: Retire Residents, Admin Approval, Safer User Creation (minimal backend change)

**Project:** ChainShield  
**Companion to:** `CAPTCHA.md` (CAPTCHA on login/registration). Build order is in section 7.  
**Revision 2:** incorporates your answers (resident role retired; officials **and auditors** can self-register; keep backend changes small; review the user-creation flow).

---

## 0. Decisions

| # | Decision |
|---|---|
| 1 | The `resident` role is retired. Existing resident accounts are deactivated, not deleted (complaints and feedback reference them). |
| 2 | Public registration is open for **`barangay_official`** and **`auditor`**. Both start as *pending* and need admin approval. `administrator` is never self-registerable. |
| 3 | Approval is a **new flag**, separate from `isVerified` (which means "email confirmed by OTP"). |
| 4 | Implementation reuses what already exists (the central auth gate, the admin user screen, the activate/deactivate endpoints) instead of adding new models or middleware. |

**Still open (product call, not blocking):** the complaint feature was built for residents. Retire it, or open it to officials?

---

## 1. Target flow

```
Register (role = official | auditor, + CAPTCHA)
   -> verify email (OTP)
   -> PENDING  (can only see the "waiting for approval" screen, log out, verify email)
   -> admin reviews in "Pending approvals"
        APPROVE -> normal login -> forced 2FA setup -> full access
        REJECT  -> account deactivated (login fails generically; email can't be re-used)
```

---

## 2. Best way to implement it with minimal backend change

**Key design choice: `isApproved` with `default: true`.**

- Only the public registration path sets `isApproved: false`.
- Every existing user, every admin-created user and every script-created user is automatically approved, so **no data migration is needed for approval**. (Mongoose applies schema defaults when it loads documents that lack the field.)
- Trade-off: it fails open for any *new* creation path someone adds later. That's acceptable here because every other path is admin-controlled, and a regression test (section 6) asserts that self-registration yields `isApproved: false`.
- Alternative if you prefer fail-closed: default `false` plus a one-line `updateMany` migration, and set `true` in each admin/script path. It touches more files, so I did not choose it.

**Enforcement reuses the existing gate.** `backend/middleware/auth.js` already blocks everything except a short allow-list when `mustChangePassword || mustSetup2FA || !isVerified || adminNeedsSetup`. Add one more condition there and every protected route is covered at once, the same way the app already handles onboarding. The allow-list (profile, logout, verify-email, resend-otp) is already right.

**The admin UI needs no new list endpoint.** `GET /admin/users` already returns every user with all fields, and `GET /auth/profile` already returns the full user object. The new flag therefore reaches the frontend with no backend work. The pending queue is just a frontend filter.

### Backend change budget (about 60 lines, 7 files, no new models/middleware/collections)

| File | Change |
|---|---|
| `models/User.js` | Add `isApproved` (Boolean, default `true`), `approvedBy`, `approvedAt`. Later: drop `'resident'` from the role enum and its `default`. |
| `middleware/validators.js` | `validateRegistration`: `role` `isIn(['barangay_official','auditor'])`. Make `position` required. |
| `controllers/authController.js` `register` | Replace the "resident only" check with a whitelist of those two roles; use the requested role; set `isApproved: false`. |
| `controllers/authController.js` `login` | Fix the self-heal bypass (below): 1-2 lines. |
| `middleware/auth.js` | Add `\|\| !user.isApproved` to the gate condition; include `pendingApproval: !user.isApproved` in the 403 JSON. |
| `controllers/adminController.js` + `routes/admin.js` | `approveUser`: copy of the existing `activateUser` handler that sets `isApproved = true`, `approvedBy/At`, and `mustSetup2FA = true`; route `PUT /users/:userId/approve` with `auditLogger('admin_approve_user')`. Rejecting = existing `deactivate` endpoint. |
| `models/AuditLog.js` | Add `'admin_approve_user'` to the fixed action enum. |

Optional (+10 lines): an `emailService` method to email "your account was approved".

**Must-fix included in this change: the self-heal bypass.** `login` currently sets `isVerified = true` for any unverified `barangay_official`/`auditor`/`administrator` with no `mustChangePassword`. That was meant for admin-created accounts, but once officials and auditors can self-register it lets them **skip email OTP** and appear in the approval queue unverified. Restrict it to `user.invitedBy` (admin-created) or delete the block.

### Frontend changes (small)

- `App.jsx`:
  - In `handleLogin`, fetch `authAPI.getProfile()` and, if `isApproved === false`, go to `/pending-approval` instead of the dashboard. This single place covers password login, new-device OTP login, and the email-verify screen, because all of them call `onLogin`. It means the login/OTP responses don't need to change.
  - Add the same branch in `checkAuth`, next to the `mustChangePassword` / `!isVerified` ones.
- `services/api.js`: in the 403 `onboardingRequired` handler, add `pendingApproval` -> `/pending-approval`.
- **New `Auth/PendingApproval.jsx`:** "Your account is waiting for administrator approval", a "Check status" button (re-fetches profile), and Log out.
- `Register.jsx`: replace the hard-coded `role: 'resident'` with a role choice (Barangay Official / Auditor) and a required position field; update the copy to explain review.
- `Admin/UserManagement.jsx`: "Pending approvals" tab with a count badge, filter `!u.isApproved && u.isVerified && u.isActive`. Show requested role, email and position prominently. **Approve** calls the new endpoint; **Reject** reuses deactivate, both with confirm modals. To approve as a different role, use the existing edit modal first.
- Remove resident UI: `ResidentDashboard.jsx`, `ResidentTransactions.jsx`, `resident` in `Sidebar.jsx` / `MainLayout.jsx` / `utils/permissions.js`, and the three `'resident'` defaults in `UserManagement.jsx`. Check `MyTransactions.jsx` and `SubmitComplaint.jsx` before deleting.

### Extra care for auditors
Auditors can read audit logs, fraud cases and reports. So:
- Show the *requested role* clearly in the queue; approving an auditor should be a deliberate click.
- Approval forces 2FA setup (handled in `approveUser`), and auditors already get an email OTP on every login.
- Admins should confirm the person out-of-band (phone/ID) before approving an auditor.

---

## 3. Review of the current user-creation flow

I traced every way an account can be created. Verdict: **the flows are inconsistent, and one is broken.**

| Path | How it works today | Problems | Adjustment |
|---|---|---|---|
| **A. Public register** (`POST /auth/register`) | Forced `resident`; emails an OTP; sets a full 24h session cookie immediately. | Resident-only (being retired); OTP stored in plain text; the full cookie is issued before any approval. | Whitelist official/auditor; `isApproved:false`; the gate blocks the cookie's access until approval. Optional: hash the OTP, or issue a scoped `verify_email` token instead of a full one. |
| **B. Admin creates user** (`POST /admin/users`) | **The admin types the password**; `isVerified: true`; `mustChangePassword: true`; **no email is sent**; 2FA forced for administrators only. | The admin knows the user's password and must pass it on by chat or paper. The email address is never proven to belong to the person (a typo gives someone else an account). Auditors and officials made here skip forced 2FA, unlike the `create_auditor.js` script which forces it. Its password regex (only `@$!%*?&` allowed) differs from the registration rules. | Server generates a random temporary password and emails it with the existing but **unused** `emailService.sendTempPasswordEmail`; the admin form no longer asks for a password. Set `mustSetup2FA: true` for officials and auditors too. Drop `resident` from `creatableRoles`. Emailing the credential also proves mailbox ownership, which justifies `isVerified: true`. About 10 lines. |
| **C. Admin invite** (`POST /admin/users/invite`) | Meant to email a link to invite an administrator. | **Cannot work as written:** it sets a `username` field that doesn't exist (the schema requires `firstName`/`lastName`), creates an `administrator` without the `_allowAdminChange` flag the model hook demands, and there is no accept-invite route in the backend. `AdminOnboarding.jsx` isn't wired into `App.jsx`. | Don't build on it. Remove the route and the dead component, or leave it untouched, but don't document it as a feature. Path B (with emailed temp password) covers the need. |
| **D. CLI scripts** (`seed-default-accounts.js`, `add_admin.js`, `create_auditor.js`, `reset-admin.js`) | Hard-coded passwords (`Password123!`, `password123`); the seed script **purges the whole database** first. | Known default passwords; no guard against running in production; `password123` doesn't even meet the app's own password policy. | Refuse to run when `NODE_ENV=production` (or require an explicit `--force`); generate a random password and print it once; keep `mustChangePassword`/`mustSetup2FA`; remove the resident seed account. |
| **E. Google SSO** | README says it exists. | No Google routes exist in this snapshot. | Treat as not implemented; update the README. |

### Adjusted flow, summarised
- **Self-registered staff:** register -> email OTP -> pending -> admin approves -> forced 2FA -> access.
- **Admin-created staff:** admin enters name, email, role -> server emails a temporary password -> first login forces password change and 2FA setup. Auto-approved.
- **Administrators:** only through admin-created flow or the guarded script; never public.

---

## 4. Security hardening (kept short; the first three matter most)

1. **Delete `GET /api/auth/hack-reset`** (unauthenticated; flips `isVerified`, `mustSetup2FA`, `mustChangePassword` for all users, which would defeat both the approval gate and 2FA).
2. **Close the self-heal bypass** (section 2).
3. **Mandatory 2FA for officials and auditors** (set on approval and on admin creation).
4. **Revoke sessions on reject/deactivate/role change.** `auth.js` checks a blacklist and `isActive`, but I did not see a token-version or `passwordChangedAt` check. Confirm, and add if missing.
5. **Public `/uploads`.** `server.js` serves it with `express.static` before any auth, exposing imported CSVs, attachments and profile photos. Put it behind `authMiddleware`.
6. **Step-up TOTP** for admin actions that grant access (approve, role change, create admin).
7. **Remove the `localStorage` token** that `api.js` still sends as a Bearer header, and the `[AUTH-DEBUG]`/`[LOGIN-DEBUG]`/`[CSRF-DEBUG]` logs (they print emails and CSRF token values).
8. Prevent deactivating or demoting the last active administrator.

---

## 5. Retiring the resident role

1. Back up (`backend/scripts/backup.sh`).
2. Add `backend/scripts/retire_residents.js` with `--dry-run`: set `isActive:false` on all `role:'resident'` users, write an audit entry, refuse to run if it would leave no active administrator.
3. Remove resident code paths: `roleMiddleware.js` `PERMISSIONS.resident`; `feedbackController.js` (~lines 109, 172, 216, 710); `transactionController.js` (~185-190, decide what officials/auditors see); `adminController` `validRoles`/`creatableRoles`.
4. After the script has run, remove `'resident'` from the `User` role enum and its default.

---

## 6. Testing

- Self-registered account has `isApproved:false`; body can't set `isApproved`, `isVerified`, `isActive` or `role: administrator`.
- Pending user is blocked from protected routes (`/transactions`, `/complaints`, `/feedbacks`, `/admin/*`) but can read `/auth/profile` and log out.
- Approve -> user can log in, must set up 2FA, then has access. Reject -> user can't log in and live sessions end.
- Admin can't approve themselves; non-admins get 403 on approve.
- Self-heal no longer verifies self-registered accounts.
- Admin-created user receives an emailed temp password and is forced to change it and set up 2FA.
- Add to `scripts/system_security_test.js` / `verify_security.js`.

## 7. Rollout order
1. Quick security fixes: `hack-reset`, self-heal, debug logs, `/uploads`.
2. Backend gate + `approveUser` + audit enum (everyone is approved by default, so nothing changes yet).
3. Frontend pending screen and admin queue.
4. Switch registration to official/auditor + pending (behind the same deploy as step 3).
5. Fix admin create flow (emailed temp password, 2FA) and script guards.
6. Retire residents (script, then code, then enum).
7. Add CAPTCHA from `CAPTCHA.md` to the new registration form.

## 8. Definition of done
- No `resident` role in code, seed data or docs; old residents deactivated with data preserved.
- A self-registered official/auditor cannot reach any protected route until an admin approves, and must set up 2FA afterwards.
- Admins never see or choose user passwords; scripts can't run destructively in production.
- Every approval and rejection is audited.
