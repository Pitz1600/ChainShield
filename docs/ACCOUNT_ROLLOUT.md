# Staff account rollout

Officials and auditors self-register, verify email, and wait for administrator approval. Pending accounts can only fetch their profile, verify email, resend verification, and log out. Approval forces authenticator setup. Rejection deactivates the account and revokes sessions. Admin-created accounts receive a random temporary password by email and must change it and set up 2FA. Configure SMTP before creating accounts.

The admin queue shows email-verified, active pending accounts. Confirm identity out-of-band, especially for auditors. Approval, account creation, and access changes require the administrator's current authenticator code. Existing staff remain approved by default. Historical retired-role accounts are blocked by authentication; their database records are preserved.

No database migration, seed, reset, backup, or retirement operation was run during implementation. Do not run seed or reset scripts against existing data. The optional retirement script supports inspection from `backend`:

```sh
node scripts/retire_residents.js --dry-run
```

Without `--dry-run`, it deactivates historical accounts without deleting them and writes an audit entry. Applying it is a separate rollout operation requiring authorization and a backup. Complaint and feedback references remain intact. Officials and administrators retain complaint permissions; auditors retain their existing read permissions.

Account provisioning and reset scripts refuse production execution. Development credentials are random and printed once. The broken invitation route is removed; use the admin create-user screen. Google SSO is not implemented.

Validation: `npm test --prefix backend` and `npm run build --prefix frontend`. Tests mock database and email operations and cover pending full/scoped sessions, revocation, approval eligibility, mass-assignment protection, and emailed admin-created credentials. Live SMTP delivery and database retirement are not executed by these tests.
