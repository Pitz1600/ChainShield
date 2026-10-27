# Annual proposal budgets

Annual Budget records the documented portion of the deployment's single barangay
budget available for ChainShield proposals. It does not enact an appropriation,
certify cash or check separate statutory purpose limits. The form does not request a supporting document or reference. Previously recorded
references remain visible; no new attachment system is introduced.

`ADMIN_APPROVED` and `totalAmountCentavos` are the authoritative proposal status
and approved amount on `revisions`. Approval accepts the submitted total; there
is no separate editable approval amount. Draft and submitted records reserve
nothing. All computations use safe integer centavos. Existing draft-only editing
protects approved amounts, years and documents. There are no proposal deletion,
archive, reopening or status override endpoints. Historical archive flags are
ignored when counting approvals. Transaction archiving affects expenditures,
not proposal approval or annual reservations.

The existing policy is one barangay per deployment, identified by
`BUDGET_PROPOSAL_BARANGAY_ID` (default `single-barangay`), not user-specific tenants.
Clients cannot supply pool scope. Historical proposal barangay labels are counted
as the existing expenditure workflow counts them. Do not change this deployment
identifier as a way to create a second pool; multi-barangay tenancy is out of scope.

## Rollout

1. Before deployment, stop API writers and take a full database backup using the
   existing `backend/scripts/backup-verify-local.js` workflow. Retain its archive,
   checksums and successful restoration verification, including proposal documents,
   transactions, receipts, expenditures and audit logs. See the existing backup
   script for its Docker requirement. No production migration is run by this change.
2. Use a MongoDB replica set (or Atlas); standalone MongoDB cannot perform approvals
   or reconciliation. Create the AnnualBudget unique index before accepting traffic
   (`await require('./models/AnnualBudget').init()` in a connected maintenance process).
3. Deploy the backend with the new checks to **all** API workers before reopening
   writes; an old worker would bypass reservations. New checks fail closed without
   a pool or reconciliation. No new feature flag is required.
4. The administrator records each fiscal-year amount on Annual Budget, then selects **Back up and reconcile this year**.
   Reconciliation snapshots all raw proposal documents (including attachment BSON
   and legacy fields) and the previous pool into `annualbudgetbackups` before the
   reservation update, in the same transaction. History retains the snapshot ID,
   administrator and timestamp. Failure rolls back the entire operation.
5. Inspect discrepancies. Missing/invalid years block all years because they cannot
   safely be assigned. Invalid amounts and inconsistent approval histories block
   the affected year. Recorded totals below existing approvals also block approval.
   Correct historical data only through an independently authorized maintenance
   procedure backed by documentary evidence, then reconcile again. This feature
   does not edit or reject historical proposals. A supported pool adjustment may
   resolve an insufficient ceiling. Do not invent allocations.
6. Verify a restore into an isolated database before enabling a reconciled year in
   production. Keep an external full backup: in-database snapshots are restoration
   points, not protection against loss of the database itself.

## Restoration

For a pre-deployment rollback, stop every writer and restore the verified full
archive into an isolated database using the existing backup verification workflow.
Check counts/checksums before an operator switches the application to that restored
database. Never roll back only a pool counter while retaining later approvals.

For a reconciliation snapshot, obtain `backupId` from that pool's history (API GET
`/api/annual-budgets/:year`) or its reconciliation response. Set
`ANNUAL_BACKUP_SOURCE_URI` explicitly and set `ANNUAL_BACKUP_RESTORE_URI` to a fresh
local `mongodb://127.0.0.1:<port>/chainshield_annual_restore_<unique>` database. Run:

```
node backend/scripts/restore-annual-budget-snapshot.js <backupId>
```

The script retains BSON types and attachment bytes, refuses a populated target,
and never modifies the source. Compare restored proposal records and the pool to
the source. For an actual rollback, stop writers and have the database operator
restore only the reviewed affected records, retaining post-snapshot expenditure
and audit data; otherwise use the full consistent backup. Reconcile all affected
years before reopening approvals. There is deliberately no web restore/delete
endpoint.

## Concurrency and access

Approvals update the pending proposal and annual pool in one transaction. Both
adjustments and reconciliation write that same pool document, forcing conflicting
transactions to retry from a fresh snapshot. Proposal status/revision checks make
retries nonduplicating (a repeated successful approval returns 409). Adjustments
also require the displayed revision, a reason and amount no lower than
reservations. Expenditure recording/review never changes annual reservations.

Administrators manage pools and reconcile; the existing Captain, Treasurer and
Auditor permissions provide reading. No new account roles are introduced.

## Verification

```
cd backend
npm test
ANNUAL_BUDGET_TEST_MONGODB_URI=mongodb://127.0.0.1:27139/chainshield_annual_test_run?replicaSet=annualTest node --test test/annualBudgets.integration.test.js
```

The integration suite accepts only a dedicated localhost fixture database and
removes that fixture on completion. It covers permissions, missing/unreconciled
pools, exact/over-budget approvals, retries and races, adjustment races, protected
approved edits, historical/archive reconciliation, snapshot bytes and independent
years. Run the existing expenditure integration suite as a regression check.
