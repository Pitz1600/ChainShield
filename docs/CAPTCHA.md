# PLAN: Add CAPTCHA to Login and Registration

**Project:** ChainShield (Node/Express + MongoDB backend, React/Vite frontend, Docker Compose)
**Goal:** Block automated abuse (credential stuffing, brute force, mass account creation, OTP email bombing) on the public auth endpoints by adding CAPTCHA, verified server-side.

---

## 1. Where the CAPTCHA goes (findings)

I traced every public, unauthenticated auth route. Only some of them need a CAPTCHA.

| Route | Frontend | Needs CAPTCHA? | Why |
|---|---|---|---|
| `POST /api/auth/login` | `Login.jsx` credentials step | **Yes** | Entry point for password guessing and credential stuffing. |
| `POST /api/auth/register` | `Register.jsx` **step 2** submit | **Yes** | Creates a DB user and sends an OTP email on every call. |
| `POST /api/auth/forgot-password` | `ResetPassword.jsx` request form | **Recommended** (Phase 5) | Sends an email per call, same abuse pattern. Not in the original ask. |
| `verify-login-otp`, `verify-mfa`, `resend-*`, `verify-email` | OTP / TOTP screens | No | Caller already passed the password check; already rate-limited. |

### Best spot on the backend
In `backend/routes/auth.js`, insert a new `verifyCaptcha` middleware **after the rate limiter and before the validators**:

```
router.post('/login',    loginLimiter,        verifyCaptcha('login'),    validateLogin,        authController.login);
router.post('/register', registrationLimiter, verifyCaptcha('register'), validateRegistration, authController.register);
```

- After the limiter, so floods are cut off before we spend a network call to the CAPTCHA provider.
- Before validators and the controller, so bots never reach bcrypt, the DB lookup, the `authDelay()`, or the email service.

### Best spot on the frontend
- **Register:** on **step 2** next to "Create Account". Step 1 is client-side only (no request is made), and CAPTCHA tokens are single-use and expire in about 5 minutes, so a widget on step 1 would often be stale by submit time.
- **Login:** inside `renderCredentialsStep()` above the submit button, and also on the TOTP step (see the caveat below).

### Caveat: the login TOTP step (this is the one that can bite)
`Login.jsx` submits to **the same** `/auth/login` endpoint twice for 2FA users: first with email and password, then again with email, password **and** `totpCode`. If the backend skipped CAPTCHA whenever `totpCode` is present, an attacker could just send a junk `totpCode` and brute-force passwords with no CAPTCHA at all.

**Decision:** require a fresh token on **every** `POST /login`, and render the widget on both steps (use the "interaction-only"/invisible appearance so the second step is nearly seamless). Simple and bypass-free. Alternative if the UX is a problem later: have the server issue a short-lived HMAC "captcha passed" token bound to the email, and accept that on the TOTP step.

---

## 2. Provider choice

**Recommended: Cloudflare Turnstile.** Free, no image puzzles for most users, good privacy story (relevant for a barangay/residents system), simple server verification via `axios` (already a backend dependency). The verifier is isolated in one file, so swapping to hCaptcha or reCAPTCHA later only touches that file and the widget component.

Server-side checks on every token:
1. POST to Turnstile `siteverify` with `secret`, `response`, `remoteip`.
2. `success === true`.
3. `action` matches the route (`login` or `register`), so a login token can't be replayed on register.
4. `hostname` matches the expected frontend host.

---

## 3. Prerequisites (do these first)

CAPTCHA does not help while these are open:

1. **Remove `GET /api/auth/hack-reset`** in `backend/routes/auth.js` (marked `// TEMP FIX`). It is unauthenticated, CSRF-exempt (GET), and sets `mustChangePassword=false`, `mustSetup2FA=false`, `isVerified=true` for **every user**. Anyone can disable the 2FA setup requirement and email verification for all accounts.
2. **Set `app.set('trust proxy', ...)`** in `backend/server.js`. Behind Docker/Nginx, `req.ip` is currently the proxy's IP, which breaks the `remoteip` sent to the CAPTCHA provider, IP-based limits, and audit-log IPs. Set it to the real number of proxy hops for your deployment.
3. **Create Turnstile site** (get a site key and secret key) and use Cloudflare's documented test keys for dev and CI.

---

## 4. Implementation steps

### Phase 1: Backend verification
- [ ] **New `backend/middleware/captcha.js`** exporting `verifyCaptcha(expectedAction)`:
  - Reads token from `req.body.captchaToken`.
  - If `CAPTCHA_ENABLED !== 'true'`, call `next()` (dev/test convenience, same pattern as `AKISMET_ENABLED`). **In production, refuse to start or log loudly if disabled.**
  - Calls `siteverify` with `axios`, with a ~5s timeout.
  - **Fail closed:** missing token, provider error, timeout, or failed check all return `400 { error: 'Captcha verification failed. Please try again.', code: 'CAPTCHA_FAILED' }`.
  - Never log the secret key or the token.
- [ ] **Strip `captchaToken` from the body** before it reaches the controller (`delete req.body.captchaToken`) so it can't leak into logs or the `User` model.
- [ ] **`backend/models/AuditLog.js`:** add `'captcha_failed'` to the fixed `action` enum, and log failures (IP, user agent, route, provider error codes). Repeated failures from one IP are a useful bot signal.
- [ ] **`backend/middleware/csrfMiddleware.js`:** no change needed. Login and register are already in `PUBLIC_AUTH_PATHS`, and CAPTCHA now covers the "unauthenticated" gap the comment there describes.
- [ ] **`backend/routes/auth.js`:** wire the middleware as shown in section 1.

### Phase 2: Frontend widget
- [ ] Add dependency in `frontend/` (e.g. `@marsidev/react-turnstile`, or load `https://challenges.cloudflare.com/turnstile/v0/api.js` directly).
- [ ] **New `frontend/src/components/Auth/CaptchaWidget.jsx`:** small wrapper that takes `action`, exposes `onToken`, and a `reset()` via ref. Reads `import.meta.env.VITE_TURNSTILE_SITE_KEY`.
- [ ] **`Login.jsx`:**
  - Keep `captchaToken` in state; include it in the `authAPI.login(payload)` call in `handleSubmit` (both credentials and TOTP steps).
  - Disable the submit button until a token exists.
  - **Always reset the widget in `finally`** (tokens are single-use), including after 401, 429, and step changes.
  - Do not add it to `handleOtpSubmit` or the `verifyMfa` branch.
- [ ] **`Register.jsx`:** render the widget on step 2 only; send `captchaToken` in the `api.post('/auth/register', ...)` body; reset on error (the existing `catch` already keeps the user on step 2).
- [ ] **Error handling:** if the API returns `code: 'CAPTCHA_FAILED'`, show a clear message and reset the widget. The existing 429 and lockout handling in `Login.jsx` stays as is.
- [ ] **Styling:** a small container in `Login.css` / `Register.css` so the widget fits the `auth-form` layout and is usable on mobile.

### Phase 3: Config and infrastructure
- [ ] **`.env.example`:** add a "CAPTCHA" section:
  - `CAPTCHA_ENABLED=true`
  - `TURNSTILE_SECRET_KEY=`
  - `VITE_TURNSTILE_SITE_KEY=`
  - Optional `TURNSTILE_EXPECTED_HOSTNAME=`
- [ ] **`docker-compose.yml`:** pass `CAPTCHA_ENABLED`, `TURNSTILE_SECRET_KEY` to `backend`, and `VITE_TURNSTILE_SITE_KEY` to `frontend` (the frontend service uses an explicit `environment:` list, so it will not pick it up automatically).
- [ ] **CSP:** the helmet CSP in `server.js` only covers API responses, so Turnstile does not need to be allowed there. Wherever the frontend HTML is actually served (Nginx in production per the README; there is no Nginx config in this repo), allow `script-src`, `frame-src`, and `connect-src` for `https://challenges.cloudflare.com`.
- [ ] **`backend/.dockerignore` / secrets:** confirm the secret key only lives in `.env`, never in the frontend bundle.

### Phase 4: Tests and docs
- [ ] **Fix existing scripts that call `/auth/login` directly** and will start failing: `backend/verify_security.js`, `backend/test_flow.js`, `backend/test_profile.js`. Run them with `CAPTCHA_ENABLED=false` or the provider's test secret key.
- [ ] **Add tests for the middleware:** missing token, invalid token, provider timeout (fail closed), wrong `action`, wrong `hostname`, valid token passes, disabled flag passes.
- [ ] **Add to `system_security_test.js`:** verify that `/login` and `/register` reject requests without a token when enabled.
- [ ] **Manual QA matrix:** login with and without 2FA, new-device OTP flow, rate-limit lockout display, register end to end, widget reset after errors, mobile layout, ad blocker / network failure behavior.
- [ ] **Docs:** update the "Security Posture" table in `README.md` and `docs/SECURITY.md` (note: `docs/SECURITY.md` currently lists an artificial delay but no bot protection), and `docs/API_DOCUMENTATION.md` (new `captchaToken` field and `CAPTCHA_FAILED` error).

### Phase 5 (optional, recommended): Forgot password
- [ ] Add `verifyCaptcha('forgot-password')` to `POST /forgot-password` and the widget to the request form in `ResetPassword.jsx`. Leave `/reset-password` (the token-based step) alone.

---

## 5. Rollout order
1. Prerequisites (remove `hack-reset`, trust proxy).
2. Phase 1 with `CAPTCHA_ENABLED=false` (no behavior change), then Phase 2.
3. Test with the provider's dummy keys locally and in CI.
4. Enable with real keys in staging, run the QA matrix, then production.
5. Keep the audit-log `captcha_failed` events visible for the first week to catch false positives.

---

## 6. Other things I noticed (out of scope, but worth a follow-up)
- `loginLimiter` is keyed by **email**, not IP. It protects one account from guessing, but doesn't stop one IP spraying many emails, and lets an attacker lock a victim out. CAPTCHA helps with the former; consider adding an IP-keyed limiter too.
- Debug logging in `authController.login` prints the attempted email (`[LOGIN-DEBUG]`), and `csrfMiddleware.js` prints raw CSRF cookie/header values (`[CSRF-DEBUG]`). Remove or gate behind a debug flag.
- README says Google OAuth/SSO is supported, but no Google routes exist in this snapshot. CAPTCHA would not apply to an OAuth redirect flow anyway.
- `backend/.npm-cache`, `.aider.*` files, and `backend/uploads/` (including profile photos) are in the project archive. Make sure they are git-ignored and not shipped.

---

## 7. Definition of done
- `POST /auth/login` and `POST /auth/register` return `400 CAPTCHA_FAILED` without a valid, route-specific token (when enabled).
- Login works for plain, 2FA, and new-device flows with no CAPTCHA bypass on the TOTP step.
- Secret key is never exposed to the frontend or logs; production fails closed.
- Existing scripts and CI pass; docs updated.
