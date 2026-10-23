# ChainShield — Optional CSV-Level Receipt Attachments

> **Implementation-ready plan for an AI coding agent**  
> **Target codebase:** `Pitz1600/ChainShield`, branch `system-and-interface-improvements`  
> **Status:** Specification / plan only. No ChainShield application code or database data is changed by this document.  
> **Storage:** Files and association manifests live on the laptop running the ChainShield backend, outside MongoDB.  
> **Highest priorities:** ABSOLUTE NO-DB-MODIFICATION RULE for receipt functionality; optional receipts; accurate CSV-to-receipt grouping; backward compatibility; minimal isolated changes.

## Final approved design — do not deviate

**Decision:** ChainShield will import **exactly one CSV per upload action**, and that CSV import may have **zero or more receipt attachments**. Each successful import gets its own unique server-generated `importId` and local receipt folder. A receipt belongs to **one and only one `importId`**. Receipts may be viewed **only in the context of that exact CSV import**, including the Receipts tab of transactions proven to belong to the import. They must **never appear for a different CSV**, even if filenames, dates, users, amounts, or transaction descriptions match.

**Required UI flow:** Select one CSV → optionally click **Attach Receipts (Optional)** immediately below **Upload & Analyze** and select multiple JPG/PNG/PDF files → click **Upload & Analyze** → on successful CSV import, attach the queued files using the returned `importId` → show success separately for CSV processing and for attachments. With no receipts selected, import normally and make no receipt-upload request. After a successful CSV import, receipts can also be added later by explicitly choosing its entry from locally recorded CSV upload history; the selection must show CSV filename, unique import identifier (or shortened ID), import time and transaction count to prevent confusion.

**Visibility invariant:** For any transaction `t` in imported CSV group `A`, the Receipts tab may show `A`'s receipts and source CSV label. A transaction in group `B` must never show receipts from `A`. No general cross-CSV receipt gallery or shared/global attachment list is to be added. The import-history selector is only for choosing the exact group when attaching files, and should not merge attachment lists. Users must also pass existing authorization checks.

**Scope lock:** Do not implement simultaneous multi-CSV file selection or CSV-to-receipt matching by name, timestamp, or guessed transaction fields. **Do not modify MongoDB in any way for receipts, including indirect writes in authentication or request middleware.** Do not modify existing transaction data, historical CSV imports, or the old branch. The new attachment feature is additive and optional.

## 1. Requirements — read before implementing

**Critical correction to the original receipt plan:** Receipts belong to **one CSV import as a whole**, NOT necessarily to an individual transaction row. A CSV may produce many transactions; all of those transactions may display the same **CSV-level supporting receipts** in their Transaction Details → Receipts tab. Do **not** force the uploader to select a transaction or attach receipts arbitrarily to one row.

1. Receipt uploading is **completely optional**. The existing CSV `Upload & Analyze` action and `Manual Entry` continue working with zero receipts. No receipt requirement for approval, verification, review, or other actions.
2. Add a secondary **`Attach Receipts (Optional)`** button **below the existing transaction CSV upload action row** in the actual Integrity Checker upload UI. Use the existing ChainShield aesthetic and interaction patterns. Do not place it exclusively in the informational Upload CSV tab of TransactionsPage.
3. Support selecting **multiple receipt files for one CSV import** (JPG, PNG, PDF). One CSV can have zero, one, or multiple receipts. Each receipt belongs to exactly one selected/imported CSV group. Never mix receipts from different CSV uploads.
4. The current application accepts **one CSV file per import HTTP request** (`upload.single('csvFile')`) and the frontend uses the first selected CSV file; users can import additional CSV files in separate requests. **Do not accidentally convert the existing CSV import endpoint into a multi-CSV endpoint.** If multiple CSV files are supported in a future version, each CSV must get its own unique group and its own receipts.
5. Every successful CSV import must receive a **server-generated, unique `importId`** and a local manifest that records the original CSV display name and the precise transaction IDs returned for that upload. **Do not use the filename alone as the association key**: files with identical names can be uploaded on different occasions.
6. Show a **`Receipts`** tab in Transaction Details for **both** non-auditor users (`MyTransactions.jsx`) and auditors (`AuditorWorkspace.jsx`). This tab lists receipts associated with the **CSV import group containing that transaction**. Filenames/rows are clickable and open an authorized preview (or a safe download fallback). Show the CSV name above the list so users understand receipts apply to the whole upload.
7. Any authorized user logged into the **same laptop-hosted backend** may view receipts when permitted to view the associated transactions. Receipt upload restricted to `barangay_official` and `administrator`; auditor view-only. Authorization is verified by backend, never by UI alone.
8. **Absolute database non-mutation rule for the receipt feature:** no collection creation, schema/model field changes, indexes, migrations, seeds, updates, inserts, upserts, deletes, receipt metadata writes, or hidden database writes from receipt handlers **or their middleware**. Read-only queries to resolve existing transactions and check access are permitted. The existing CSV import must retain precisely its previous transaction-saving behavior; the new receipt functionality must introduce **zero additional MongoDB writes**. See § 1A for an important existing middleware side effect.
9. Old branch continues to read all existing transactions with no receipt UI; new branch sees local receipt groups. No old-branch migration or database restructuring. Receipt storage must persist across branch switches and Docker restarts.
10. No OCR, receipt analysis, ML retraining, blockchain writes, requirement to upload the original CSV permanently, or automatic inference of associations from unrelated transaction data.

## 1A. HARD STOP: absolutely no database modification by receipt functionality

**Non-negotiable coding-agent instruction:** Under no circumstances should receipt implementation change MongoDB contents, schemas, indexes, collections, connection configuration, or migration state. Do not modify `backend/models/Transaction.js`, other Mongoose model definitions, `backend/config/database.js`, seeders, or existing collections for this feature. **Receipt metadata and CSV-to-transaction mapping belong only in local manifest JSON files.**

**Permitted:** Read existing transaction identifiers/visibility through read-only MongoDB queries such as `findById`, `find`, or `exists`; preserve the legacy CSV import transaction writes exactly as they already behave. On a successful CSV upload, store the returned transaction IDs in a new *local JSON manifest*, not a Mongoose document. Return an additive `importId` in the HTTP response; do not persist this `importId` in MongoDB.

**Forbidden:** Any new `save`, `create`, `insert*`, `update*`, `delete*`, `bulkWrite`, `findOneAndUpdate`, schema migrations, collection creation, or index builds resulting from a receipt API. A receipt API must not trigger an indirect database write through another service, audit hook, or authorization middleware.

**Existing-code caveat that MUST be addressed:** `backend/middleware/auth.js` currently issues a periodic `User.updateOne(...)` to refresh `lastSeenAt` during otherwise read-only authenticated requests. To satisfy a *strict* zero-database-writes rule, receipt-specific routes MUST also suppress this side effect. Use a **narrow, explicit read-only request option/flag** set before calling existing authentication middleware and make authentication honor that flag by skipping *only* `lastSeenAt` persistence for receipt API requests. Keep token validation, blacklist checks, roles, onboarding restrictions, CSRF, and all existing security checks unchanged. Do not weaken global authentication or alter unrelated endpoints. Alternatively implement an equivalently secure receipt-only read-only authentication path if this is safer in the current branch. If this zero-write invariant cannot be achieved safely, **stop and report the blocker** rather than violating the rule.

**Important distinction:** Importing a CSV through the existing `POST /api/transactions/import` route necessarily saves normal transaction records to MongoDB; that is pre-existing ChainShield functionality and must remain unchanged. The no-write rule applies to **all new receipt operations and to all extra effects added to CSV import for linking receipts**. It does not disable the current transaction-import pipeline. Never rerun or modify a transaction record merely to attach, list, or view receipts.

**Validation requirement:** With a seeded test database, capture MongoDB state before and after uploading/listing/viewing receipts on already imported CSV groups, including auth/user and audit-log collections. These receipt actions must leave **all database collections and documents unchanged**, not merely the Transaction model. When testing a new CSV import, compare database effects against the unchanged import baseline; only the pre-existing transaction writes are allowed. Fail the feature if any new DB mutation is observed. Use safe test fixtures; do not run destructive testing on the real defense database.

## 2. Verified codebase facts and where to work

| Current source | Verified behavior | Required additive change |
| --- | --- | --- |
| `frontend/src/components/IntegrityChecker/IntegrityChecker.jsx` | Actual CSV upload UI: file input `id="csvFileInput"`, `handleFileChange` takes `e.target.files[0]`, `handleUpload` posts only `csvFile` to `/transactions/import`, button row `.upload-actions-footer` contains `Upload & Analyze` / `Manual Entry`; only one result set cached in browser `integrity_checker_results_v1`. | Add optional receipt selector/dialog immediately **below** `.upload-actions-footer`. Use the `importId` from the successful import response. Preserve existing CSV/manual functions, validation, and result view. |
| `frontend/src/components/Transactions/TransactionsPage.jsx` | `Upload CSV` navigation tab shows an informational card, not the real CSV file picker. | Avoid placing the only receipt control here. |
| `backend/routes/transactions.js` | `POST /api/transactions/import` uses `upload.single('csvFile')`. Separate `/batch` handles transactions, not multiple CSV files. | Keep request contract; optionally enrich successful import **response** with `importId`. Mount separate receipt routes; do not interfere with CSV Multer. |
| `backend/controllers/csvImportController.js` | Processes all valid CSV rows through `multiStagePipeline.processBatch`, responds with per-row `results` including `transactionId`, then deletes temporary uploaded CSV. Currently no persisted original CSV grouping/ID or import history. | On successful import, create local manifest tying unique `importId` and CSV name to **actual returned transaction IDs**; return `importId` along with all existing response fields. Do not change CSV analysis, staged/approval flags, persistence logic, or error contract. |
| `backend/models/Transaction.js` | Has unique business `transactionId` and Mongo `_id`; no import-group model field. | **Do not edit.** Look up/read identifiers only. |
| `frontend/src/components/Transactions/MyTransactions.jsx` | Modal tab state `modalTab`; existing tabs in `.modal-tabs`; auditor path renders separate `AuditorWorkspace`. | Add `Receipts` tab and receipt list for non-auditors using the selected transaction ID. |
| `frontend/src/components/Transactions/AuditorWorkspace.jsx` | Has independent `tabs` array and `.aw-tabs`; not covered by MyTransactions tab rendering. | Add auditor's **read-only Receipts tab** using shared list component. |
| `frontend/src/services/api.js` | Axios with credentials and CSRF request interceptor for writes. | Add client helpers for import group history, attaching multiple receipts, listing receipts by transaction, and authenticated viewing. Keep existing interceptors. |
| `backend/server.js` | Express app, existing authenticated `/uploads` static handler, CSRF, mounted transaction router. | Register receipt router in correct order. Keep receipt directory **outside** existing static `/uploads` route. |
| `backend/middleware/auth.js` | Existing auth middleware reads user/token state **and periodically writes `User.lastSeenAt`**. | Receipt-only read-only guard must prevent this incidental write for receipt routes without changing overall authentication/security or any database record. |
| `backend/package.json` | Already includes Express and Multer. | Prefer no new dependency. |
| `docker-compose.yml` | Backend bind-mounts `./backend:/app`, runs Node as non-root in Dockerfile. | Keep local data host-mounted and ensure runtime write permissions. |
| `.gitignore` | Does not ignore receipt storage currently. | Ignore `/backend/local-receipts/`. |

## 3. Data model — local filesystem only

**One import ID per successfully processed CSV.** Use `crypto.randomUUID()` (or equivalent secure unique generation) on the backend, not a client-generated filename or timestamp.

Illustrative layout:

```text
backend/
  local-receipts/                # gitignored, laptop-hosted, NOT public static
    imports/
      4b0e...-uuid/
        manifest.json
        files/
          40d1...-uuid.pdf
          f28c...-uuid.jpg
      920d...-uuid/
        manifest.json
        files/
          31a4...-uuid.png
```

Example `manifest.json` — explanatory only:

```json
{
  "version": 1,
  "importId": "4b0e...-uuid",
  "sourceCsvName": "october-expenses.csv",
  "uploadedAt": "2026-10-23T07:00:00.000Z",
  "uploadedBy": "existing-user-id",
  "transactionIds": ["TX-001", "TX-002", "TX-003"],
  "receipts": [
    {
      "receiptId": "40d1...-uuid",
      "storedName": "40d1...-uuid.pdf",
      "originalName": "expense-summary.pdf",
      "mimeType": "application/pdf",
      "size": 160832,
      "uploadedAt": "2026-10-23T07:01:00.000Z",
      "uploadedBy": "existing-user-id"
    }
  ]
}
```

- `transactionIds` **must reflect successfully imported rows**, not guessed counts, CSV filename, matching descriptions, original row numbers, or arbitrary pre-import form values. The present controller returns unique `transactionId` values in `results`; use those. Empty/unresolved groups should not create false associations.
- Store an empty `receipts: []` array **even when no receipts are provided**, allowing receipts to be added later to the exact import. The import manifest is a **new local file**, not a new MongoDB record.
- Files are opaque UUID filenames; metadata stores safe display names. Never derive disk paths directly from user-supplied names/IDs; validate UUIDs and enforce containment within the configured root.
- Implement atomic manifest writes (temporary file + rename) and concurrency-safe update strategy or locks for concurrent receipt additions. Avoid metadata corruption and orphaned files after failures.
- For this laptop demo, a small set of manifests can be searched read-only to find the import containing a `transactionId`; for larger datasets add a **filesystem-only** index, not a MongoDB field. If using a local index, protect against race conditions and rebuild it from manifests if necessary.
- Optionally calculate SHA-256 of the uploaded CSV for diagnostic/audit reference; **do not use filename or hash alone as the upload group's identity**. Duplicate filenames still get distinct IDs.
- Do not publicly expose `local-receipts/` under `/uploads` or any `express.static` directory.

## 4. Exact end-user flow

### 4.1 Uploading a CSV without receipts (unchanged)

```text
[Choose CSV]  october-expenses.csv
[Upload & Analyze]  [Manual Entry]
[Attach Receipts (Optional)]
```

The user can click **Upload & Analyze** without touching receipt controls. CSV parsing, AI results, staged transactions, and approvals work normally. On **successful import**, the backend also creates an empty local import-group manifest and returns `importId` (additive response property). No user prompts, delays, or required receipt field.

### 4.2 Selecting multiple receipts before or after import

**Preferred MVP behavior:**

- Click **Attach Receipts (Optional)** beneath the existing upload action row.
- If a CSV is selected **but not uploaded yet**, allow selecting multiple JPG/PNG/PDF files; queue them **in frontend memory only** as optional attachments for that currently selected CSV. Clearly show `Will attach to: october-expenses.csv after successful import`. Allow removing queued files. Do **not** upload receipt files before CSV import succeeds. If the selected CSV changes, discard queued receipts or ask the user to reconfirm the target; never silently attach to a different CSV.
- User clicks **Upload & Analyze**. Keep existing single-CSV import request/analysis unchanged. Server creates a unique import group on success and returns `importId`. Then, if any receipts were queued, the frontend sends them to the separate receipt endpoint using that **exact returned importId**. An attachment failure must not roll back or report CSV processing as failed. Show a clear warning and offer retry on the same group.
- If the CSV **already finished importing**, the button should open a compact **Choose CSV upload** selector that lists recent **locally recorded import groups** with filename, upload timestamp, and transaction count. User explicitly selects the correct group and then chooses one or more receipts. Do not rely on a cached last result as the sole history, because the current UI overwrites that cache on each import.
- Support uploading additional receipts to any existing group later, subject to permissions. There is no requirement for receipts to be attached at import time.
- If no receipt files are queued, skip the receipt upload request entirely.

### 4.3 Multiple CSVs and multiple receipt files

The current application imports **one CSV per request**, but permits a user to run more imports after the previous request. This is not the same as bulk selecting multiple CSVs in one dialog. Keep this behavior unchanged.

```text
First request: October.csv  -> importId A -> TX-001, TX-002, TX-003 -> Receipt A1.pdf, A2.jpg
Second request: November.csv -> importId B -> TX-004, TX-005        -> Receipt B1.png
Third request: Other.csv    -> importId C -> TX-006                -> no receipts
```

- **Multiple receipts:** Yes, new feature supports several files per CSV group in one selection and allows additional uploads later (suggested MVP cap: 10 files/request, 5 MiB each; adjust after testing). Use receipt-specific `multer.array('receipts', maxCount)` and validate actual file type, not only extension/MIME.
- **Multiple CSVs at once:** Not supported in the **existing** single-upload UI/API. Do **not** change `upload.single('csvFile')` as part of this scope. If later implemented, create **one import group per CSV** and send an explicit association of each receipt set to the intended group.
- File naming does not decide linkage: `expenses.csv` uploaded twice is two separate groups. Concurrent uploads should not overwrite each other's manifests.

### 4.4 Transaction Details -> Receipts tab (CSV-level references)

Add a **Receipts** tab to both existing transaction detail interfaces, styled like the other tabs.

```text
Transaction Details: TX-002
[AI Analysis] [Import Data] [Breakdown] [Auditor Remarks] [Receipts]

Receipts — supporting files for CSV import
Source CSV: October.csv
  📄 Receipt A1.pdf        PDF · Oct 23, 2026   [View]
  🖼 Receipt A2.jpg        Image · Oct 23, 2026 [View]

These files are attached to the CSV upload containing this transaction,
not individually verified as evidence for TX-002.
```

**Lookup logic:** Verify logged-in user's permission to see the requested transaction, read its business `transactionId` from the existing record, locate its local import group, and list the group's receipt metadata. A transaction from a different CSV sees only its own group's files. A transaction without a known source import group displays: `No CSV-level receipts available for this transaction.` (not an error).

- Clicking a list row opens the corresponding authorized image/PDF preview; provide safe download fallback. Use authenticated API fetching with credentials and appropriate CSP/`nosniff` headers. Never expose raw disk paths.
- List filename, type, upload date, optionally uploader, and indicate the **source CSV**. Use loading/error/empty states consistent with existing UI.
- The auditor UI uses `AuditorWorkspace.jsx` and **needs a separate tab addition**; do not assume the non-auditor `MyTransactions.jsx` tabs cover it.
- Archived/pending/staged transactions must follow existing access/visibility policies. The receipt API must not reveal hidden transactions or associated document groups through an ID guess.

## 5. Proposed isolated backend API

Preserve all existing endpoints. Add separate authenticated endpoints (exact prefixes can be adapted to existing router registration):

| Method | Route | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/transactions/import` | Existing admin/official | **Existing CSV flow.** On success, add `importId` to current JSON response; create local manifest. No new required request field. |
| `GET` | `/api/receipt-imports` | Authenticated with transaction visibility | List accessible local CSV import groups (id, CSV name, date, transaction count, receipt count); do not expose other groups. |
| `POST` | `/api/receipt-imports/:importId/receipts` | Admin/official | Add multiple receipts to the **explicitly identified** local import group; use receipt-specific Multer, CSRF, auth and validation. |
| `GET` | `/api/transactions/:txId/import-receipts` | Authorized viewer | Read-only lookup of transaction, its local import group, and the shared receipt list. `:txId` should be the Mongo `_id`; resolve business `transactionId` on the backend. |
| `GET` | `/api/receipt-imports/:importId/receipts/:receiptId/file` | Authorized viewer | Validate requested receipt belongs to import and user may view associated transactions; stream safe file content. |

**Important implementation notes:**

- Current `auth` middleware performs existing account validation **but also periodically updates MongoDB `User.lastSeenAt`**. Use the § 1A read-only receipt-request guard (or equivalent secure implementation) so **receipt routes cause zero MongoDB writes, including middleware side effects**. Retain `requireOfficial` and the CSRF interceptor on uploads. Do not weaken checks to accommodate local storage.
- A GET for a receipt by import group must check the viewer's right to access the specific association/group; never assume `auth` alone grants global file access.
- `POST /api/transactions/import` must report CSV results **exactly as before** with `importId` added. If local group initialization fails after successfully importing transactions, do not claim a failed import; surface/log the independent attachment-store error, and provide safe recovery/retry. Never rerun CSV import to retry receipts.
- Do not store complete CSV raw data or financial rows in local receipt manifests when transaction IDs suffice. The controller currently cleans up the temporary CSV; preserve cleanup.
- Validate upload count, total size, individual sizes, extension, content signature, safe filenames, path containment, and authorization; reject HTML/SVG/executables. Write uploads outside web-served paths.
- Protect file preview with `Content-Type`, `X-Content-Type-Options: nosniff`, safe `Content-Disposition`, and restrictive CSP/sandbox where applicable; prefer downloading unsafe documents rather than rendering active content.
- Keep local data under an explicit `RECEIPT_STORAGE_DIR` or a stable path such as `path.join(__dirname, 'local-receipts')` resolved relative to backend root (not process current working directory). Confirm Docker UID/GID can write to the host bind mount.
- No receipt deletion/replacement API needed for this MVP.

## 6. Suggested file changes (minimal diff)

**Backend:**

```text
backend/controllers/csvImportController.js       # additive successful import manifest + importId
backend/routes/receiptImports.js                  # new route
backend/services/localImportReceiptStore.js       # new manifest + receipt operations
backend/server.js                                 # register new receipt route, no static access
backend/middleware/auth.js                         # minimal receipt-only read-only guard to suppress lastSeen DB write
backend/test/receiptImports.test.js               # new tests
.gitignore                                        # ignore /backend/local-receipts/
```

Keep `backend/models/*`, database configs/migrations, ML services, blockchain services, and transaction processing rules **unchanged**. Keep `backend/routes/transactions.js` existing CSV Multer `single('csvFile')` unchanged.

**Frontend:**

```text
frontend/src/components/IntegrityChecker/IntegrityChecker.jsx
frontend/src/styles/IntegrityChecker.css
frontend/src/components/Transactions/MyTransactions.jsx
frontend/src/components/Transactions/AuditorWorkspace.jsx
frontend/src/services/api.js
frontend/src/components/Receipts/ImportReceiptDialog.jsx    # new
frontend/src/components/Receipts/ImportReceiptList.jsx      # new
frontend/src/components/Receipts/ReceiptViewer.jsx          # new
frontend/src/components/Receipts/Receipt.css                # new, scoped
```

Use existing colors, typography, cards, control radii, focus states, spacing, responsive tab scrolling, and Lucide icons (`Paperclip`, `FileText`, `Upload`, `Eye`). Do not introduce an unrelated UI system. Prefer shared list/view components across both transaction-detail interfaces.

## 7. Compatibility and historical CSV uploads

The system currently **does not persist a source CSV group identifier** with the transactions, and deletes each temporary uploaded CSV. Therefore **legacy transactions imported before this feature cannot be safely assigned to a particular CSV group automatically** in all cases.

- Do not fabricate an import grouping by matching dates, descriptions, or names. For older transactions, display a neutral `No source CSV receipt group recorded` state.
- If historical CSV grouping is truly needed, plan a separate **manual or verification-assisted local-only grouping** step with explicit source CSV and read-only matching of known stable transaction IDs. Do not modify MongoDB and do not merge groups by guessing.
- No migration required for normal new uploads; all successful imports after implementation get local manifests, even with zero receipts.
- **Old branch:** existing transactions and analytics remain usable; receipt controls absent. **New branch:** same MongoDB data plus receipt views from local manifests.
- Switching Git branches in the same checkout must not remove local receipt files. Gitignore them and back them up separately. Never run cleanup commands that remove ignored application data.
- Other computers or separate backend instances do not share files automatically: only users connected to the same laptop-hosted backend (and storage path) see the same receipts.

## 8. AI coding agent implementation sequence

1. Inspect the exact listed files on the target branch. Confirm the import response shape, transactional result IDs, CSS, and both details-modal code paths.
2. Implement local filesystem manifests and validated receipt storage, atomic writes, UUID IDs, and strict path containment outside static assets. No MongoDB writes.
3. Extend successful CSV imports *additively*: create `importId` and local manifest containing actual result transaction IDs, include `importId` in existing JSON response, preserve existing CSV validation and result data.
4. Add separate authenticated receipt-import routes for listing groups, adding many files, listing a transaction's associated CSV receipts, and viewing files. Enforce group/transaction access permissions and CSRF.
5. Add frontend API methods using the existing Axios instance and existing auth/CSRF; support multipart multiple files and authenticated blob viewing.
6. Add secondary optional receipt button **below** `.upload-actions-footer`; build a simple native-styled chooser for pending CSV and/or explicitly selected previously imported CSV group; don't auto-map on filenames.
7. Add read-only `Receipts` tab to `MyTransactions.jsx` **and** `AuditorWorkspace.jsx`, with shared clickable receipt list and source CSV label.
8. Confirm Docker host persistence, `.gitignore`, responsive styling, keyboard navigation, error handling, and a clean diff with **no MongoDB models/migrations/db data changes**. Verify auth middleware cannot indirectly write `lastSeenAt` for any receipt endpoint.
9. Run existing tests plus all acceptance cases below. Clearly report any tests that could not run in the current environment; do not claim success without evidence.

## 9. Acceptance tests — must pass

### CSV behavior
- [ ] A CSV with many transaction rows imports and analyzes correctly with **zero receipts**, same outputs and approval workflow as before.
- [ ] A second CSV can be uploaded later; the first upload's receipt group remains unchanged.
- [ ] Selecting multiple CSV files in one file picker is **not** claimed to work; current CSV import remains one CSV per request.
- [ ] Two different imports with the same original CSV filename receive distinct `importId` values and never share receipts.
- [ ] An invalid CSV (bad columns/duplicate transaction IDs) does not create a misleading valid import group with associated receipts.
- [ ] CSV import processing failure cannot result in receipts falsely linked to a different/imported group.

### Receipt behavior
- [ ] Optional `Attach Receipts` button appears **below** transaction upload controls, never disables `Upload & Analyze`, and matches ChainShield styling.
- [ ] Selecting 2–3 JPG/PNG/PDF files for a single CSV attaches **all** files to exactly that CSV's `importId`; user can preview each.
- [ ] User can upload a CSV with no receipt and later explicitly select it from import history to attach multiple receipts.
- [ ] Changing selected CSV before import does **not** silently transfer previously queued receipts to the different CSV.
- [ ] Receipt upload failure after successful CSV import shows a separate error and supports retry without re-importing transactions.
- [ ] Multiple logged-in authorized users connected to the same laptop backend see the same stored receipts.
- [ ] Administrator and official may attach; auditor can view but cannot attach. Unauthenticated users cannot list/download/attach anything.

### Details tab and association
- [ ] Every transaction belonging to CSV A can view **CSV A's** receipt list with a clearly labeled source CSV; this is a shared CSV-level attachment, **not** row-level attestation.
- [ ] A transaction from CSV B never shows CSV A's receipts.
- [ ] No view, list, preview, or upload operation permits receipts in import group A to be treated as receipts of import group B.
- [ ] Uploading same-named CSV files twice keeps their receipts and transaction mappings fully separate.
- [ ] The same list is available in **both** Transaction Details and the **Auditor Workspace** receipt tabs.
- [ ] Transaction not mapped to a recorded CSV group gets a clear empty state, not guessed receipts or a crash.
- [ ] Clicking a listed JPG/PNG/PDF opens the right authorized file and closes cleanly; denied or missing files fail safely.

### Database/branch safety
- [ ] **Zero additional MongoDB mutations:** no receipt route changes any document or collection (including `User.lastSeenAt`, audit logs, index creation, or background middleware writes); verify with before/after database snapshots in a safe test environment.
- [ ] The only MongoDB writes during CSV import are the **existing** transaction writes the pre-feature import already performed; attaching receipts adds none.
- [ ] No Mongoose schema, existing database record, index, migration, or receipt-related MongoDB write was changed.
- [ ] Old branch still works with unchanged transaction data and no receipt UI.
- [ ] New branch still finds local receipts after restart/branch switch; receipt files are not committed to Git.
- [ ] Storage remains on the laptop filesystem (including when launched via Docker bind mount), and separate local backup is documented.

## 10. Scope boundary and completion criteria

Implement **CSV-import-group-based optional receipts** with multiple files per group, a clear upload selection, two receipt-list tabs, local metadata/files, and old-branch compatibility. **Do not implement per-row receipt assignment**, a bulk multi-CSV upload feature, receipt OCR, ML/document authentication claims, or any MongoDB modification whatsoever for receipt functionality—including indirect middleware updates. Deliver code plus test results; if any required behavior conflicts with the present architecture, explain the precise blocker rather than silently weakening these requirements.
