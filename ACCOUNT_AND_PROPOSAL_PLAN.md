# ChainShield: Account Creation and Proposal Editing Plan

**Baseline:** `revisions`, commit `d3817ab6a014816e932470d02ad7f11c4f6bd69e`.

## Scope

1. Restrict account creation to the Municipal DILG Officer acting through the existing administrator role.
2. Allow administrators to modify submitted budget proposals before a decision.

Confirm the DILG Officer's actual administrator account as a deployment task. Complete account creation restrictions first, followed by proposal editing.

## 1. Administrator-only account creation

### Intended workflow

1. The Municipal DILG Officer signs in as administrator and opens User Management → Create User.
2. The administrator enters the user's details and assigns the appropriate role and position.
3. The existing account-creation flow creates the account and sends temporary credentials by email.
4. The new user signs in and completes the existing first-login password and security steps.

### Implementation

- Disable the public `POST /auth/register` endpoint on the backend so direct requests cannot create accounts. Return a clear response directing users to the administrator.
- Remove public registration links and the public registration route from the frontend. Explain that accounts are created by the administrator.
- Retain the existing administrator account-creation endpoint, authentication, role check, rate limit, and step-up verification.
- Review the existing email-failure behavior and give the administrator a clear result if temporary credentials cannot be delivered.
- Preserve Captain submission-permission assignment when an administrator creates or updates an eligible Captain account.
- Record the creator and account-creation event using existing user and audit fields.
- Keep existing accounts and pending registrations unchanged; do not silently approve or delete them. Administrators can review pending registrations separately.
- Retain the initial administrator bootstrap method so the system can be set up without public registration.

### Completion checks

- [ ] Public registration cannot create an account, including through direct API requests.
- [ ] Ordinary officials and auditors cannot access account creation.
- [ ] An administrator can create the supported staff accounts and the user can complete first login.
- [ ] Email-delivery failure produces a clear result and has a usable recovery path.
- [ ] Existing users can sign in; pending registrations are unchanged.
- [ ] Captain access assignment and administrator bootstrap continue to work.

## 2. Administrator modification of submitted proposals

### Intended workflow

1. A Captain submits a proposal.
2. An administrator opens the pending proposal and chooses **Edit Proposal**.
3. The administrator changes the necessary details and supplies a reason.
4. The system presents the original and revised values for review.
5. Saving the changes keeps the proposal in **Pending Review**; it does not approve the proposal or reserve funds.
6. The administrator reviews the revised total and then approves or rejects the proposal.
7. The Captain can see what changed, who changed it, and why in the proposal history.

Example: if the original proposal totals ₱100,000 and an administrator changes an item so the revised total is ₱85,000, the history shows both values, the editor, the time, and the reason.

### Implementation

- Add an administrator-only edit endpoint for `SUBMITTED` proposals. Keep the existing Captain-only draft edit endpoint.
- Allow changes to proposal details and project items, including amounts. Keep the fiscal year fixed in this first version.
- Reuse existing validation and recalculate totals on the server; never trust a client-supplied total.
- Require a reason, preserve the Captain's original submitted snapshot, and record the administrator, timestamp, reason, and changed values in proposal history. Keep supporting documents intact.
- Reuse the existing revision number to reject stale edits. If another administrator edits, approves, or rejects first, require a reload.
- Show the revised total and annual budget available during review. On approval, the existing annual-budget check must evaluate the revised total against the reconciled pool and reserve it atomically.
- Prevent editing after approval or rejection. Later changes to approved proposals require a separate controlled workflow because expenditures can depend on their allocations.
- Keep editing and approval as separate actions.

### Completion checks

- [ ] Only an administrator can edit a submitted proposal; the Captain's draft workflow still works.
- [ ] A reason is required and the original and revised values remain visible to the Captain.
- [ ] Concurrent or stale edits cannot silently overwrite a decision or another edit.
- [ ] Saving changes does not approve the proposal or reserve annual funds.
- [ ] Approval checks the revised total and blocks amounts exceeding the available annual budget.
- [ ] Approved and rejected proposals cannot be edited through the new endpoint.
- [ ] Existing proposal attachments, expenditure records, and report behavior remain available.

## Delivery and verification

1. Implement and test administrator-only account creation and existing onboarding paths.
2. Implement proposal editing, review history, and concurrency protection.
3. Run the relevant backend and frontend tests and production build. Add focused tests for authorization, onboarding, revision conflicts, audit history, and annual-budget enforcement.
4. Validate end-to-end in an isolated environment using administrator, Captain, Treasurer, and auditor test accounts. Verify representative existing proposals and expenditures remain accessible.
5. Before changing a shared database, take and verify a backup using the existing project process. No deletion or migration of existing users or financial records is required by this plan.

This plan is based on source review; the deployed environment has not been independently tested.
