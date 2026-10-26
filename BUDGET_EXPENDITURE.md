# ChainShield — Budget-Linked Expenditure Submission and Evidence Management

**Status:** Implemented and verified. Local database backup and exact-version MongoDB 8.0.34 replica-set restore passed (13 collections, 3,302 documents). Backend 79/79, frontend 10/10, build and expenditure browser checks pass. Enabled in the local development `.env`; production remains separately gated. See `docs/BUDGET_EXPENDITURES.md`. No source database migration or destructive restore was performed.  
**Scope:** Replace the treasurer's standalone transaction-upload journey with expenditure submission **inside the approved budget's detail page**, require supporting evidence, and **reuse the existing AI Integrity Checker unchanged**.

**Deployment clarification:** This application is deployed for one barangay only. All
budgets in its database belong to that deployment. No cross-barangay uploads, tenant
selection or per-user barangay assignments are part of this feature. Existing barangay
labels remain historical metadata. Role permissions and budget/expenditure association
checks remain mandatory.

## 1. Objective and non-negotiable constraints

Once a budget proposal is approved, authorized treasurers must be able to open it, view the approved allocation and recorded spending, and submit each expenditure with mandatory receipts and supporting documents. Every expenditure belongs to exactly one approved budget proposal. Auditors can inspect expenditure details, the existing AI results, and attached evidence before verifying or flagging the expenditure.

**Hard constraints:**
- **Do not retrain, replace, fine-tune, reconfigure, or change the existing AI/ML model.** Do not change its features, scoring thresholds, prediction logic, training data, controllers, inference endpoints, or input/output contract.
- **Do not implement OCR, document scanning, image recognition, receipt-content extraction, or AI analysis of file contents.** The old Integrity Checker continues to assess the structured financial/transaction fields it already accepts.
- **Do not rewrite the existing AI backend or existing working transaction processing services.** Prefer adapters/orchestration and new budget/evidence endpoints outside the existing AI module, calling supported services exactly as they are.
- **Do not break or rewrite the working budget approval flow.** Connect to the approved budget record using its existing identifier/status and permissions.
- **Do not delete historical transaction records or blockchain entries.** Retire the old independent upload experience in the UI only after data is backed up and existing features and references are audited.
- Maintain authorization, audit logging, secure file handling, and human verification. An AI assessment must never be presented as receipt verification or proof of payment.

> **Repository verification note:** The project reference provided is `https://github.com/Pitz1600/ChainShield/tree/system-and-interface-improvements`. The referenced branch could not be fetched through the available GitHub connection at planning time, so paths and integration points below are candidates to verify against the **actual current branch** before coding. The older indexed repository includes `backend/models/Transaction.js`, `backend/routes/transactions.js`, `frontend/src/components/Transactions/TransactionsPage.jsx`, `frontend/src/components/IntegrityChecker/IntegrityChecker.jsx`, `frontend/src/components/Layout/Sidebar.jsx`, and `frontend/src/components/Layout/MainLayout.jsx`. Do not assume these files or roles are unchanged in the new budget implementation.

## 2. User workflow

1. Barangay official creates a budget proposal using the existing workflow.
2. Authorized official approves it using **existing budget approval functionality**. Record the approved budget and allocations as an immutable reference for future expenditure checks.
3. The approved budget becomes visible in **Treasurer → Approved Budgets** for the deployment's barangay.
4. Treasurer opens **Budget Details**. The same page displays approval information, allocations, expenditure list, and **Record Expenditure**.
5. Treasurer enters expenditure data using **the same fields and data types required by the current transaction/Integrity Checker pipeline**, plus a parent budget allocation/category when available.
6. Treasurer attaches **(a) receipt or proof of payment and (b) supporting document**. Both are required for final submission; supported evidence can include images or documents. If a single file legitimately satisfies both categories, allow it to be classified for both rather than forcing duplicate upload (subject to business validation).
7. Server validates budget approval, treasurer authorization, amount, attachment requirements, and allocation spending limit. It creates an expenditure linked to the selected budget and securely associates the evidence.
8. The **existing Integrity Checker** processes the compatible structured financial data exactly as before. Store/link its original result unchanged. If the checker fails, mark the assessment as unavailable/pending; do not fabricate a result or discard a successfully saved submission.
9. Auditor reviews the AI result **and manually views/downloads the evidence**. Auditor can verify, request correction, or reject the submission with a recorded reason.
10. Budget details display the updated expense list, distinct pending/verified totals, remaining funds, and audit history. Submitted versions and originals remain traceable.

### Core placement principle

**Treasurer navigation:** `Approved Budgets → [Approved Budget] → Record Expenditure + Attach Evidence → Submit`.  
Do **not** require the treasurer to visit a separate Integrity Checker or transaction upload page to complete submission. Auto-populate and lock the parent budget reference in the form.

## 3. Treasurer UI plan

### 3.1 Approved Budgets list

- Show only budgets appropriate to the deployment's barangay, according to their role permissions.
- Columns/cards: proposal number/title, approval status/date, approved total, recorded expenditure total, verified expenditure total, unspent balance, and **View Budget**.
- Only **approved** budgets allow new expenditures. Other statuses can be view-only according to current authorization rules.

### 3.2 Budget Details page (single point of action)

**Header:** approved proposal title/ID, program/activity, approval date/approver, category allocation(s), read-only approved amount.  
**Summary cards:** approved amount, recorded/pending total, verified spending, and available remaining balance (explicitly labeled).  
**Expenditure list:** date, description, supplier/payee, amount, review status, original AI risk result, evidence count, view details.  
**Primary action:** prominently located **Record Expenditure** button, opening an inline form or panel on the **same page**.  
**Evidence section in that form:**
- *Receipt / Proof of Payment* — required, multiple files if needed.
- *Supporting Document* — required, multiple files if needed (e.g., purchase order, invoice, disbursement voucher, delivery/acceptance records).
- Clear filenames, type indicators, upload progress, remove/replace before final submission, and short explanations of accepted formats.
- Accept at minimum PDF/JPG/JPEG/PNG/DOCX; DOC is optional if the storage and preview strategy safely supports it. Files are stored and viewed/downloaded; **no text parsing is performed**.
- Preserve the existing transaction form fields needed by the current integrity prediction. Add a budget allocation selector only if the approved budget includes multiple tracked allocations.
- Disable **Submit** until required information and both evidence categories are present; enforce the exact same checks **server-side**.

**Suggested button copy:** `Submit Expenditure & Run Existing Integrity Check`.  
**Helper text:** "The automated integrity check analyzes financial details entered in this form. Receipts and documents are reviewed separately by the auditor."

### 3.3 Auditor view

- Within each approved proposal, list all submitted expenditures, linked documents, and original AI risk scores/explanations.
- Provide manual file preview/download; show uploader, timestamps, file category, and verification status.
- Actions: `Verify`, `Request Correction`, `Reject` with reason. Do not let treasurer self-verify.
- Show audit history and superseded attachment versions; do not silently replace a submitted evidence file.

### 3.4 Navigation and labels

- Make **Budget Proposals / Approved Budgets** the primary workflow.
- Remove or hide the **standalone transaction upload navigation for treasurers** once the integrated form is functional.
- Optionally relabel user-facing `Transaction` as `Expenditure`, `Transaction Details` as `Expenditure Details`, and `Integrity Checker` as `Expenditure Integrity Check` **without renaming/replacing backend contracts**.
- Keep necessary legacy transaction routes/features intact for internal compatibility until migration tests pass.

## 4. Data and API integration — additive, low-risk

Use the *actual latest schemas* for specific field names and route paths. The following is conceptual, not a mandate to rename current collections.

### 4.1 Preserve existing structures

- Keep existing budget proposals, approvals, transactions, AI service, model artifacts, and history.
- **Prefer retaining the existing `Transaction` records internally**, presented in the UI as *expenditures* rather than renaming the MongoDB collection or reconstructing ML inputs. This is the lowest-risk compatibility strategy.
- Add a nullable `budgetProposalId` reference to new expenditure-associated records (and `allocationId` where appropriate), using an additive schema change or a separate linkage collection if changing the transaction model is risky.
- Existing records without a budget link remain legacy records; they are not automatically or incorrectly assigned to an approved budget.

### 4.2 Proposed evidence metadata

Maintain separate evidence metadata, linked to expenditure/transaction ID and budget ID. Suggested fields:

```text
Evidence {
  id,
  budgetProposalId,
  expenditureId / transactionId,
  category: "receipt" | "supporting_document",
  originalFilename,
  mimeType,
  byteSize,
  storageKey,             // private storage, not public user-controlled URL
  sha256,
  uploadedBy,
  uploadedAt,
  version,
  replacedBy?,
  archivedAt?
}
```

Document metadata is **not** added to existing AI input. Restrict retrieval to authorized roles for the matching budget/expenditure; use server-validated paths/keys and audit access when appropriate.

### 4.3 Expenditure review metadata

Use separate/extended review state without modifying the ML prediction output:

```text
ExpenditureReview {
  expenditureId / transactionId,
  budgetProposalId,
  reviewStatus: "submitted" | "under_review" |
                "correction_required" | "verified" | "rejected",
  aiAssessmentReference?, // unchanged existing inference result
  reviewerId?,
  reviewReason?,
  reviewedAt?,
  history: [...]
}
```

**Clarify status boundaries:** Budget `approved` is a different status from expenditure `verified`. No automated AI prediction should set the human review status to verified.

### 4.4 Minimal new integration interfaces

Design new endpoints around the current budget model, using current application route conventions:

```text
GET    /budgets/:budgetId/expenditures
POST   /budgets/:budgetId/expenditures
GET    /budgets/:budgetId/expenditures/:expenditureId
POST   /budgets/:budgetId/expenditures/:expenditureId/evidence
GET    /budgets/:budgetId/expenditures/:expenditureId/evidence/:fileId
POST   /budgets/:budgetId/expenditures/:expenditureId/review
```

These are **illustrative endpoints**, not required replacements of existing routes. Reuse current transaction creation and AI trigger through adapters/controllers wherever possible. An implementation may prefer one multipart submission endpoint to atomically validate transaction information and required file references.

**Submission atomicity:** Do not leave a final submitted expense with missing required attachments. Support draft/temp-file cleanup, transaction/session where possible, and compensating cleanup on failure. If an AI inference error occurs after a valid submission, persist `aiPending/aiFailed` separately for retry without duplicating the expenditure.

### 4.5 Budget amount control

- Server validates requested spending against the approved **allocation**, not only the proposal's overall total.
- Track verified expenditures and all pending/reserved expenditure submissions separately to avoid oversubscription (including concurrent submissions).
- Do not count rejected expenses as verified spending; define whether corrected pending expenses reserve budget until adjudication.
- Distinguish **reported**, **verified**, and **available** amounts in API and UI. Do not imply uploads prove a payment happened.
- Approved amount and approved line-item allocations remain read-only. Use the existing authorized amendment/approval process for budget changes, if available.

## 5. Reusing the AI Integrity Checker — strict no-change integration

**Never edit** the existing model files, training pipeline, feature engineering, scoring formula, thresholds, inference logic, or AI API input/output schema as part of this feature.

- On submission, pass existing structured transaction fields (e.g., amount, date, description, category, counterparties, as required by the current code) to the **current** transaction/AI pipeline in the **original format**.
- Use the already returned AI result exactly as is; associate the result with the expenditure's current transaction ID / budget link in surrounding records.
- Do not pass receipt binaries, PDFs, or new evidence metadata to the model.
- Do not claim the AI compared documents, authenticated receipts, validated vendors from file contents, or proved that funds were used as proposed.
- If existing AI inputs cannot be populated from the new form, retain the required fields in that form; **do not silently default invented values** and do not change the AI input contract.
- A failing/unavailable AI response must be represented accurately and logged; it must not be interpreted as low risk.

**User-facing disclosure:** "AI risk analysis uses recorded expenditure details only. Attached receipts and documents are not scanned or analyzed by AI; an authorized auditor must review them manually."

## 6. Security, integrity and audit requirements

- Enforce authentication, treasurer submission permissions, and auditor review permissions **on the server**, not only by UI visibility.
- Block uploads to unapproved or inaccessible budgets, mismatched budget/expenditure IDs, and exhausted allocations.
- Validate file extension **and detected MIME/file signature**; limit size/count, sanitize display names, use random storage keys, and store outside publicly accessible paths.
- Treat uploaded documents as untrusted content. Serve with safe download/preview headers; never execute office macros or uploaded files server-side. Add malware scanning only if a safe existing facility is available; otherwise mark it as a future security enhancement, not AI/OCR scope.
- Preserve file hashes, uploader ID, upload timestamp, and change/audit events. Existing blockchain hashing mechanisms may be reused **only if compatible**, without blockchain redesign; do not represent a file hash as proof of authenticity.
- Reject unauthorized replacement/deletion of submitted evidence; corrections generate new versions with a reason.
- Log record creation, upload, submission, analysis reference, verification, rejection, and correction; include who/when/what and before/after IDs.
- Prevent mismatched-budget or unauthorized document access through ID guessing.

## 7. Database backup and migration plan (mandatory before code rollout)

**Preflight:** Identify active MongoDB database(s), collections, storage locations, schema indexes, current budget approval model, existing transactions, evidence facilities, and blockchain dependencies. Inventory all consumers of current transaction endpoints and navigation.

1. Create **timestamped MongoDB backup** (`mongodump --archive --gzip` or existing backup solution) containing budget, transaction, account, approval, AI-result, and audit collections; back up external evidence objects/files separately if already in use.
2. Confirm backup files exist and have nonzero size, and write down DB version, timestamp, environment, and restore procedure; restrict backup access.
3. Test a **restore into a separate non-production database** and verify representative counts, relationships, and documents. Never test restore over production.
4. Apply additive schema/index changes first. Make `budgetProposalId` optional for old transactions but mandatory for **new expenditure submissions** at the application boundary.
5. Preserve all historical records and immutable chain references. If hiding the legacy Transactions UI, archive it at navigation level; do not drop the collection or delete unrelated records.
6. Deploy behind a feature flag if supported. Verify actual accepted budgets, permissions and uploads before enabling for all treasurers.
7. Roll back frontend routing and new routes if needed; retain backup and refrain from any irreversible data changes. If new records already exist, use a reconciliation/migration script rather than blindly restoring old DB over recent entries.

## 8. Implementation phases

### Phase 0 — Verify actual current implementation
- Locate current budget proposal model, statuses, approval events, treasurer/auditor roles, submission form, file storage implementation, AI triggers, and blockchain writes.
- Confirm existing transaction fields **exactly** required by current AI pipeline.
- Record impacted components/routes and import dependencies. Avoid editing until the contracts are documented.

### Phase 1 — Backup and additive links
- Create and restore-test MongoDB backup.
- Add budget↔expenditure association and evidence metadata with indexes and permission checks.
- Ensure legacy transaction records remain readable.

### Phase 2 — Treasurer approved-budget page
- Add Approved Budgets list with detail page.
- Embed **Record Expenditure** and mandatory evidence attachments directly on the budget details view.
- Reuse old structured transaction form fields and processing; auto-set the selected budget ID; keep totals/read-only approved amount visible.

### Phase 3 — Existing AI integration (no model changes)
- Route compatible expenditure data to the existing Integrity Checker exactly as today.
- Display original model output on expenditure detail and budget record.
- Ensure failures are safely recorded without duplicate submissions.

### Phase 4 — Auditor review and reporting
- Add manual review of attachments and reasoned verification/correction/rejection.
- Show pending vs verified amounts, evidence status, and audit history per budget.

### Phase 5 — Navigation cleanup and regression tests
- Replace treasurer standalone transaction-upload entry points with the integrated budget flow.
- Keep internal transaction and prediction APIs in place; migrate or hide only the **legacy UI** where safe.
- Test existing approvals, role access, AI behavior, reporting, transaction history and blockchain integrations.

## 9. Acceptance criteria / QA checklist

- [ ] Existing budget approval flow works unchanged.
- [ ] Treasurer sees only approved budgets in this single-barangay deployment.
- [ ] Clicking a budget shows the expenditure form **on that budget's page**.
- [ ] Budget association is automatic, server-validated, and immutable for the submitted expenditure.
- [ ] Submission without receipt/proof of payment is blocked (client and server).
- [ ] Submission without supporting document is blocked (client and server).
- [ ] Accepted evidence formats and file limits are enforced; malicious/disguised files and unauthorized downloads are rejected.
- [ ] Multiple expenditures attach to one proposal; no expenditure exceeds permitted allocation, including concurrent requests.
- [ ] Existing AI model files, features, thresholds, training, inference endpoint contract, and outputs remain **byte-for-byte/logically unchanged** (diff and smoke-test).
- [ ] AI result is linked to correct expenditure and shown unaltered; the interface states AI does not analyze uploaded files.
- [ ] AI failure does not create fabricated low-risk results or duplicate expenditures.
- [ ] Treasurer cannot approve their own expense or alter the approved budget amount.
- [ ] Auditor can view evidence and independently verify, reject, or request correction with a mandatory reason for adverse outcomes.
- [ ] Approved and recorded/verified/pending balance calculations are accurate and unambiguous.
- [ ] Submitted evidence and audit history remain retrievable with versioning; no silent deletion.
- [ ] Existing transactions, dashboards and blockchain references are preserved or deliberately adapted without breaking their old data.
- [ ] MongoDB backup and restore verification are completed and documented before migration.
- [ ] Navigation no longer sends treasurers to a separate transaction-upload screen.

## 10. Explicitly out of scope

- OCR, image scanning, document parsing and extraction, computer vision, receipt authenticity scoring, file-content validation by AI.
- Model retraining, new models, ML feature or threshold changes, and AI backend rewrite.
- Automatic payment execution, bank reconciliation, automatic document approval, or claims that an uploaded receipt proves goods/services were delivered.
- Removing the old transaction MongoDB collection, destructive reset of historical records, or rebuilding blockchain storage.
- A resident-facing workflow unless separately scoped.

## 11. Suggested commit boundaries

1. `docs: approve budget-linked expenditure plan and backup instructions`
2. `feat: add expenditure-to-approved-budget linkage and evidence metadata`
3. `feat: embed expenditure submission and attachments in treasurer budget detail`
4. `feat: associate unchanged integrity checker results with expenditures`
5. `feat: add auditor evidence review and budget spending summaries`
6. `refactor(ui): retire treasurer standalone transaction upload navigation`
7. `test: add budget expenditure integration, RBAC, upload and regression coverage`

**Definition of done:** A treasurer can complete the entire expenditure and mandatory evidence submission from an approved budget page; the old AI system evaluates the same structured data it already evaluated, without changes; an auditor can manually inspect attachments and act on the record; and neither existing data nor the approved budget flow is lost.


### Implemented CSV/manual entry extension

Record Expenditure supports Manual Entry and Upload CSV inside the approved budget.
CSV upload uses the existing Integrity Checker format and batch processing, with preview,
allocation selection and required per-row evidence before one atomic batch submission.
See docs/BUDGET_EXPENDITURES.md for limits, APIs and verification details.
