# Budget expenditures rollout

This installation serves **one barangay only**. No Treasurer or auditor needs a
barangay assignment, selector or separate tenant configuration. Approved budgets in
this application database belong to the deployment’s barangay. Existing stored labels
remain metadata; role permissions and budget/expenditure ID checks enforce access.

The additive workflow lives at `/dashboard/approved-budgets` and `/api/approved-budgets`.
It uses the existing `ADMIN_APPROVED` proposals, item IDs, centavo amounts and unchanged
`multiStageFraudPipeline.processBatch(input, { requireApproval: true })` interface.
No model, inference controller, training data, thresholds or AI contract was changed.
Evidence bytes never enter that pipeline. Returned assessments are stored unchanged.
Historical transactions remain unassigned and are not deleted or migrated.

## Preflight and backup (required before enabling)

**A local backup and isolated restore were verified on 2026-10-26.**
See the verification record below. Keep
production `BUDGET_EXPENDITURES_ENABLED=false` until the following environment-specific steps are recorded by the operator.
Do not enable solely because the code builds.

1. Inventory the active MongoDB URI/database without logging credentials, server version,
   collection counts/indexes, GridFS/external file storage, blockchain references and the
   existing consumers of transaction APIs. This repository stores proposal documents in
   MongoDB; the new evidence bytes also reside in private MongoDB documents.
2. Use MongoDB Database Tools with credentials supplied securely. With restrictive
   `umask 077`, create a timestamped `mongodump --uri "$MONGODB_URI" --archive="$BACKUP_ARCHIVE" --gzip`.
   Dump the complete application database including users, proposals, transactions,
   assessments/alerts, audit logs and evidence. Separately back up existing external
   uploads. Check archive/file sizes, hash and protected access.
3. Restore into a **separate isolated MongoDB deployment** using
   `mongorestore --uri "$ISOLATED_RESTORE_URI" --archive="$BACKUP_ARCHIVE" --gzip`.
   Never point the restore URI at production. Compare counts and representative users,
   approvals, documents, transaction hashes and relationships. Record timestamp,
   environment, server/tools versions, archive hash, counts and restore evidence.
4. A MongoDB replica set or sharded cluster with transaction support is required. Do
   not deploy against standalone MongoDB. Create the `BudgetExpenditure` indexes
   (particularly unique `(budgetProposalId, submissionKey)`) before accepting traffic.
   Existing proposals gain only a reservation map; existing approval logic stays intact.
5. Use verified, administrator-approved accounts with position `Barangay Treasurer`
   for submissions and role `auditor` for reviews. No barangay assignment is required.
   Administrators can inspect approved budgets; only auditors decide expenditure reviews.
6. Enable the feature in staging, validate the acceptance scenarios, then enable in
   production. The flag exposes Approved Budgets and retires Treasurer transaction /
   Integrity Checker UI entry points. Their legacy APIs and other roles' UI remain.

## Storage, accounting and failures

Each submission atomically inserts a `BudgetExpenditure` (including both evidence
categories) and reserves its amount against the whole approved budget in the parent proposal, inside a
MongoDB transaction. Concurrent writes serialize on that proposal. All money is
integer centavos. Pending, correction-required and verified expenditures reserve funds;
rejection releases the reservation exactly once. Recorded totals include rejected
submissions and are labeled accordingly. No client may change approved allocations.

The Treasurer entry form is visible when opening a budget. Manual and CSV entries
require no allocation selection; receipts and supporting documents remain mandatory.
New entries without an allocation use the internal `__whole_budget__` marker. Existing
allocation-linked records remain intact. The atomic spending limit sums every reservation
in the proposal map, including historical allocation reservations, against the approved
proposal total. Rejection releases the entry’s original reservation bucket. No data
migration is required. Deploy the backend change together with the frontend change.

Evidence is limited to five files, 5 MB each, 10 MB combined per upload. PDF, JPEG,
PNG and DOCX extension/MIME/signature validation reuses the existing document policy.
One file can have both categories. Downloads require authentication and matching
budget/expenditure IDs and use attachment, sandbox, no-cache and nosniff headers. No public
URLs are created. In expenditure details, **View evidence** opens a private in-app viewer:
PDF and JPG/PNG previews use an authenticated fetch and a temporary local blob URL;
DOCX files use a text-only preview, with the original download available for formatting
and embedded images. Preview requests use the same evidence authorization and log
`evidence_viewed`. Closing the viewer cancels requests and releases local blob URLs.
No evidence is sent to an external document-viewing service. No malware scanner is available; scanning remains future work.

Correction uploads require the submitting Treasurer, an auditor correction request,
a reason and a complete new evidence set. Originals and history remain available;
versions append, with a 12 MB cumulative per-record byte limit to leave MongoDB BSON
headroom. Structured financial details are immutable; an auditor can reject an incorrect
submission and the Treasurer can submit a corrected expenditure. There is no silent
replacement/deletion. Embedded history commits with each state change.

Analysis runs after commit using only existing structured fields. A submission key
makes HTTP resubmissions idempotent. Pending/unavailable analysis is never shown as
low risk. The pipeline can persist a transaction before failing; deterministic `EXP-`
transaction IDs permit reconciliation without blindly rerunning it. There is deliberately
no automatic retry. A crash can leave assessmentStatus pending: inspect the matching
transaction and repair the link under operational review, never resubmit blindly.
Existing transaction mutation APIs reject `EXP-` records so they cannot bypass the
budget review/reservation state. Human reviews synchronize transaction status when
the linked transaction exists and retain the original assessment separately.

## Validation and rollback

Run backend and frontend tests and the frontend build. In a replica-set staging
instance, test simultaneous submissions for the last allocation funds, interrupted
analysis, duplicate submission keys, both required evidence categories, disguised
files, unauthorized roles and mismatched-budget access/downloads, independent auditor decisions and corrections.
Verify existing approvals and historical transaction/blockchain references.

Rollback by disabling the flag and reverting routing/UI as needed. Keep evidence,
expenditure records and reservation fields. Never restore an old backup over recent
production writes or drop historical collections; reconcile new records first.

## Implementation verification — 2026-10-26

- Full backend suite: **79/79 pass**, including 15 real HTTP/replica-set expenditure
  scenarios and their parent integration test. Existing approval and receipt-import
  regression suites also pass. Receipt-only authentication now respects its existing
  `receiptReadOnly` flag without changing authentication/authorization checks.
- Frontend tests: **10/10 pass**. Production build passes with a pre-existing CSS
  syntax warning. Targeted lint for the expenditure component passes.
- Headless Firefox passes Treasurer navigation, required financial fields and both
  evidence categories, embedded manual/CSV submission, original risk explanations, manual downloads,
  auditor decisions, adverse decision reasons, refresh and JavaScript error checks.
- Real concurrency tests confirm allocation reservations cannot oversubscribe and
  simultaneous rejection releases funds once. Corrections preserve originals. Analysis
  failures retain the submission. Reviews during analysis retain reviewer identity/time
  on the eventual transaction. Idempotent retries neither reserve nor analyze again.
- The adapter converts the recorded timestamp to the Date type required by the existing
  transaction hash/pipeline. Existing pipeline, inference, thresholds and ML files have
  no diff. Evidence is never passed to them.
- Approved Treasurers and auditors work without per-user barangay assignments.
  Existing per-record labels never filter out budgets in this single-barangay installation.
  Captain proposal ownership and administrator approval controls remain enforced.

Reproduce the integration suite with an explicitly isolated localhost fixture database:

```sh
EXPENDITURE_TEST_MONGODB_URI='mongodb://127.0.0.1:27188/chainshield_expenditure_test_check?replicaSet=chainshield_verify' npm test --prefix backend
npm test --prefix frontend
npm run build --prefix frontend
npm run test:browser:expenditures --prefix frontend
```

The integration test rejects remote/application database URIs, creates fixture records
only in a `chainshield_expenditure_test_` database, and drops only that fixture database.
Without its explicit URI it skips, so ordinary tests do not touch MongoDB.

## Verified backup and exact-version restore

Backup: `backups/20261026T054815Z/database.archive.gz` (257,762 bytes).
Uploads: `backups/20261026T054815Z/uploads.tar.gz` (1,953,826 bytes).
Original report: `backups/20261026T054815Z/verification.json`.
**Exact-version report:** `backups/20261026T054815Z/verification-mongo8.json`.

All 13 collections and 3,302 documents restored into **MongoDB 8.0.34**, the exact
source version, on replica set `chainshield_verify`. Complete document hashes,
collection options and indexes match the saved source inventory. Both archive checksums
and gzip integrity were verified. The source database was not modified.

Docker's kernel 7.0.12 cannot run MongoDB 8 (SERVER-121912). The initial Docker MongoDB
7 test was followed by an exact-version native MongoDB 8 verification on the compatible
host kernel 7.2.0. Official binaries were extracted from `mongo:8.0` to
`/tmp/chainshield-mongo8-tools`. Local data and logs remain under the private backup
folder, separately from the unchanged archive. The restored application database was
not used for test fixtures.

The temporary native verification server has been stopped; all restored files remain.
To start it again from the project root (the binaries must still be present):

```sh
/tmp/chainshield-mongo8-tools/mongod --dbpath "$PWD/backups/20261026T054815Z/mongo8-data" --port 27188 --bind_ip 127.0.0.1 --replSet chainshield_verify --setParameter ttlMonitorEnabled=false --logpath "$PWD/backups/20261026T054815Z/mongo8-server.log" --logappend --fork
```

To check the already-restored database without accessing the source:

```sh
RESTORE_VERIFY_URI='mongodb://127.0.0.1:27188/?replicaSet=chainshield_verify' node backend/scripts/verify-restored-backup.js backups/20261026T054815Z
```

The original `backup-verify-local.js` remains available for new timestamped backups;
it uses MongoDB 7 in Docker on this machine, so follow it with exact-version verification
when needed. Archive files are private and excluded from Git, but are not encrypted.

## Development configuration

The root `.env` identifies this environment as development. After the exact-version
restore, replica-set tests and browser checks passed, its local
`BUDGET_EXPENDITURES_ENABLED` flag was set to `true`. It takes effect on the next
backend start (recreate an existing Docker backend to reload environment variables).
The `.env.example` rollout default remains `false`; production enablement is separate.
No production service was restarted and no staff assignments or source data were changed.


## Single-barangay verification — 2026-10-26

Removed the expenditure barangay-assignment API/UI and per-user barangay filters.
Tests cover approved Treasurers and auditors with no barangayId, plus existing labels,
while retaining ordinary-official denial, budget/expenditure ID matching, approval,
independent review, evidence protection and concurrent spending controls. Captain access
management now controls submission permission only; it does not select a barangay.
No historical records or stored barangay labels were rewritten.


## CSV or manual entry — 2026-10-26

The approved budget’s Record Expenditure panel now offers **Manual Entry** and
**Upload CSV**. The CSV option uses the existing Integrity Checker template and
unchanged CSVColumnMapper; it supports the old manual-entry CSV headers, debit/credit
amount columns, quoted descriptions and itemized columns. Required financial details
must actually be present; the adapter does not invent missing payees, agencies or dates.

CSV workflow: choose the CSV (rows load automatically) and upload evidence →
select the applicable evidence for each row → submit against the whole budget.
A shared invoice/supporting document can be explicitly applied to multiple rows.
Every CSV row must have at least one assigned evidence file. CSV uploads use the general expenditure_evidence category automatically; users do not classify files. Manual entry retains its existing receipt/supporting-document requirements.

New authenticated Treasurer endpoints:

- POST /api/approved-budgets/:id/expenditures/preview-csv (csvFile only; no saves)
- POST /api/approved-budgets/:id/expenditures/import-csv (csvFile, evidence files,
  rows JSON with evidenceIndexes (allocationId is optional for legacy clients), submissionKey)

Limits: 25 rows, UTF-8 CSV at most 2 MB, 20 evidence files at most 5 MB each and
10 MB combined, 12 MB total buffered multipart file data, and 25 MB stored evidence
across all rows (including explicitly shared documents). Split larger batches.
All CSV rows and evidence are revalidated on final submission. Reservation and record
creation commit together in one MongoDB transaction; any invalid row, duplicate source
record, missing evidence or insufficient overall budget balance aborts the entire save.

The full CSV batch is then sent once to the unchanged processBatch service using the
same original CSV import options: requireApproval=true, staged=true, batchSize=250,
useML=true. Its returned results are retained unchanged. Original CSV source record
IDs, row numbers, filename and SHA-256 remain metadata outside the AI inputs. Optional
itemized fields are preserved. CSV source IDs and file/row hashes have partial unique
indexes per budget; legacy/manual records remain unaffected. A retry with the same
submission key returns the original saved batch. If analysis fails after transaction
persistence, records stay saved/unavailable and deterministic IDs reconcile transaction
references without calling inference again.

Validation: backend 79/79; frontend 10/10; production build and targeted lint pass.
Firefox smoke tests cover both entry methods, CSV preview, per-row evidence, explicit
shared-document selection, batch submission, downloads and auditor review. Integration
tests use real MongoDB transactions and the unchanged batch service, with a local
fixture response at the ML HTTP boundary; model behavior and production model files
are not modified by these tests.

### Auditor supporting evidence

Auditors can use **Upload Audit Evidence** in expenditure details at any review
status, including CSV-created expenditures. Treasurer documents and Auditor
supporting evidence appear separately. Uploads require an explanation of up to
4,000 characters and accept PDF, DOCX, JPG/JPEG and PNG with matching MIME and
content signatures: five files per request, 5 MB each, 10 MB combined. The separate
cumulative Auditor limit is **50 files / 50 MB per expenditure**. Files are
append-only; explain an incorrect attachment in a subsequent upload.

`POST /api/approved-budgets/:id/expenditures/:expenseId/audit-evidence` accepts
multipart `evidence` files and `explanation`. Only active, approved, verified
Auditors with completed onboarding can upload. The matching
`GET .../audit-evidence/:fileId` uses existing expenditure reader authorization
and checks both parent IDs. No public URLs are created.

The private `auditorevidences` collection holds one document per file, including
SHA-256, uploader identity/name, timestamp and parent references. Ordinary API
responses omit file bytes. A MongoDB transaction commits the complete batch,
expenditure counters and `audit_evidence_uploaded` history references together.
The expenditure counter update serializes concurrent uploads. No migration is
needed for existing expenditures (missing counters are treated as zero). Include
this collection in normal database backups. No changes are made to review,
financial reservations, Treasurer evidence limits, or AI assessments.

Audit Review Reports include separate Treasurer and Auditor inventories, with
Auditor explanation, uploader, date, size, MIME type, checksum and file reference.
Documents themselves are not embedded or sent to the AI checker.

Auditor evidence verification (2026-10-27): 78 backend tests passed, 20 isolated
replica-set expenditure/report integration checks passed, frontend tests/build
passed, and Firefox fixture workflows passed at 320–1440 px. Checks include
inactive/unapproved/unverified users, cross-parent download attempts, invalid
batches, injected mid-write failure, concurrent cumulative limits, CSV expenditures,
and preservation of Treasurer evidence, financial reservations and AI results.
The frontend build still reports its existing unrelated CSS syntax warning.
