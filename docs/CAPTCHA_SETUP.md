# CAPTCHA setup and verification

Login and registration use Cloudflare Turnstile. Forgot-password protection remains an optional follow-up.

## Deployment

Create a Turnstile widget in Cloudflare with the frontend hostname allowed. Configure:

```dotenv
CAPTCHA_ENABLED=true
TURNSTILE_SECRET_KEY=<server-only secret>
TURNSTILE_EXPECTED_HOSTNAME=app.example.com
VITE_CAPTCHA_ENABLED=true
VITE_TURNSTILE_SITE_KEY=<public site key>
TRUST_PROXY_HOPS=1
```

`TURNSTILE_EXPECTED_HOSTNAME` defaults to the hostname in `FRONTEND_URL`. Set `TRUST_PROXY_HOPS` to the actual trusted reverse proxy count: zero for a direct connection, one only when all traffic passes through one trusted proxy. Restrict direct backend access when trusting a proxy; do not use one hop for mixed direct/proxied paths. This repository's Compose deployment exposes the backend directly and therefore defaults to zero.

Compose derives the frontend enable flag from `CAPTCHA_ENABLED` and passes only the public key to the frontend. For local Vite outside Compose, place `VITE_CAPTCHA_ENABLED` and `VITE_TURNSTILE_SITE_KEY` in `frontend/.env.local`. Vite substitutes these at build time, so rebuild production assets after changing them. Keep frontend and backend enable flags synchronized. Backend production startup requires CAPTCHA enabled, a secret, and an expected hostname, and rejects Cloudflare test secrets. Secret keys belong only in backend configuration; backend Docker context excludes environment files.

On the server serving frontend HTML, allow `https://challenges.cloudflare.com` in CSP `script-src`, `frame-src`, and `connect-src`. The API's Helmet policy does not govern frontend HTML. Production Nginx configuration is external to this repository.

## Development and automated checks

For the existing direct-login scripts (`verify_security.js`, `test_flow.js`, `test_profile.js`), start a development backend with `CAPTCHA_ENABLED=false` and disable the frontend flag as well. Setting the variable only on a client script does not disable the running server. Alternatively provide a fresh login token with `CAPTCHA_TOKEN`; never reuse it.

Cloudflare publishes [dummy site and secret keys](https://developers.cloudflare.com/turnstile/troubleshooting/testing/) for widget and provider testing. The always-pass public key is `1x00000000000000000000AA`, with server secret `1x0000000000000000000000000000000AA`. Dummy verification responses can contain fixed `action: test` and `hostname: localhost`; strict route-action checks remain enabled, so use mocked responses in the middleware suite for end-to-end route acceptance, or real development keys bound to your development hostname. No test-key action bypass is implemented.

Run `npm test` in `backend/` for mocked provider checks, including actual HTTP login/register requests with CAPTCHA enforced, without MongoDB or Redis. Run `npm run build` in `frontend/`. To add checks against a running full deployment, run `CAPTCHA_ENABLED=true node scripts/system_security_test.js` with `ADMIN_TOKEN` and `USER_TOKEN`; the backend must also have CAPTCHA enabled.

Server verification follows the [Cloudflare Siteverify API](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) and uses a five-second timeout. Tokens are single-use: frontend resets them after every attempted login/register request.

## Manual QA before rollout

- Plain password login succeeds with a completed challenge.
- TOTP login obtains a second token; a junk `totpCode` without CAPTCHA returns `400 CAPTCHA_FAILED`.
- New-device email OTP and authenticated MFA screens work without extra challenges.
- Registration renders CAPTCHA only on step 2 and succeeds through email verification.
- Invalid credentials, invalid registration, `429`, lockout, and `CAPTCHA_FAILED` reset the challenge while preserving form fields and countdowns.
- Expired tokens disable submit; retry obtains a fresh token.
- Blocked scripts, provider outages, and network failures show a usable retry message and do not permit submission.
- Check narrow mobile screens and keyboard interaction.
- Check expected hostname, trusted client IP, and `captcha_failed` audit details in staging; monitor failures during the first week.

Live browser flows and staging checks require configured keys and a running application; unit tests do not substitute for these checks.
