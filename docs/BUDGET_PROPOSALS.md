# Budget proposals

Budget Proposals appears in the existing navigation for administrators and explicitly entitled Captains. Officials' registration position text never grants access.

## Setup

This installation serves one barangay. An administrator can use Admin Panel → User Management → Manage Captain submission access to enable or disable an approved Captain’s submission permission, using a current authenticator code. There is no barangay picker or per-user barangay assignment. Captains retain ownership-based access to their proposals; administrators review all proposals in this installation.

Existing email-verified Captains with recorded administrator approval or administrator invitation are recognized automatically unless their submission access was explicitly managed/disabled. New administrator approvals, Captain position updates and administrator-created Captain accounts assign the capability automatically. Email verification alone and self-declared positions never grant access. No seeds, migrations, live database writes or backup commands are run by this implementation. Back up the deployment database through the existing operational process before rollout. The implementation baseline was commit `d89bf3f025b79f75146bff2d82aa4c87fd1318c1` with existing uncommitted frontend changes.

For legacy accounts with no recorded administrator approval/invitation, an administrator can confirm the Captain position by saving the user in User Management, or use the explicit assignment controls. This preserves the distinction between email verification and a trusted Captain appointment.

New proposal records use the server-managed `BUDGET_PROPOSAL_BARANGAY_ID` label (default `single-barangay`). This is metadata for the installation, not a tenant selector or access requirement. Older labels are preserved and do not hide a Captain’s existing proposals.

Optional environment configuration: `BUDGET_PROPOSAL_LIMIT_CENTAVOS` sets a positive integer total limit. Without it there is no policy limit beyond safe integer centavo arithmetic.

## Behavior and storage

Captains save partial drafts, add item cards and optional files, review a saved summary, and submit. Submission requires complete details and positive item amounts. Submitted proposals are immutable; administrators approve administrative review or reject with a reason. Revision returns are outside this MVP. Proposal numbers use year plus a random UUID for concurrency-safe uniqueness.

The dedicated `BudgetProposal` collection never creates transactions or changes budget summaries. Monetary values are integer centavos and totals are recomputed on the server. Every draft update, document change, submission and decision appends a history event in the same atomic MongoDB document update. Conditional status and revision checks prevent stale saves and competing decisions. Submitted metadata/items are preserved in a SHA-256 hashed snapshot. History is embedded rather than stored in a separate collection so standalone MongoDB deployments also retain atomic state/history consistency. The existing global AuditLog receives matching events; its existing best-effort behavior remains unchanged. Embedded history is authoritative if global audit logging fails.

Supporting documents are stored as private MongoDB buffers, excluded from ordinary reads, and retrieved only through the proposal authorization check. There are no public filesystem upload paths. File extension, MIME and content signatures are checked; Office files must contain the expected OOXML package entries and cannot contain encrypted, macro or executable entries. Each file is at most 5 MB; at most five files and 10 MB combined per proposal. Downloads force attachment disposition and disable caching. Include this collection in database backups. Normal list results are limited to the most recent 200 matching proposals.

## Verification

- `npm --prefix frontend run build`: passed.
- ESLint on the four modified/new frontend integration modules: passed. Full frontend lint reports 30 existing errors and two warnings elsewhere.
- `node backend/test/budgetProposals.test.js`: eight tests passed (entitlement, validation, content checks, scoping, atomic submission, stale/duplicate updates, decisions and draft locks).
- `npm --prefix backend test`: 42 passed, two existing receipt-import tests failed because authentication updates presence timestamps. Tests need localhost listener permission in restricted environments.
- `npm --prefix frontend test`: passed.

No running authenticated browser session or disposable MongoDB instance was available for end-to-end persistence verification. Before deployment, exercise creation, multiple attachments, reload, concurrent review and download with separate Captain/Admin sessions against a disposable database. The existing transaction collection and routes are unchanged.
