# Auditor Supporting Evidence Upload Plan

**Baseline:** ChainShield `revisions`, commit `12bc232168603962a348d5b99fa45785fb02c2eb`.

## Goal and scope

Allow an authorized Auditor to attach supporting audit evidence to a specific expenditure in the existing Approved Budgets workflow. Keep Auditor evidence distinct from the Treasurer's submitted receipts and supporting documents.

Existing functionality: Treasurers attach receipts and supporting documents to expenditures; Auditors can download those files, record a decision, and request corrections. This plan adds Auditor uploads for expenditures, including those created through CSV import.

## Intended workflow

1. The Auditor opens **Approved Budgets** and selects an expenditure.
2. Expenditure details show separate sections for **Treasurer's documents** and **Auditor's supporting evidence**.
3. The Auditor selects **Upload Audit Evidence**, chooses files, and enters a short explanation of their relevance.
4. The system saves the evidence and displays the uploader, upload date, explanation, and download action.
5. The Auditor can continue to verify, reject, or request a correction using the existing review actions.
6. Authorized users can download the evidence; the Audit Review Report lists it in its evidence inventory.

Example: for a road-repair expenditure, an Auditor could attach an inspection photo and explain that it documents the completed work.

## Access and storage

- Add an upload endpoint restricted to active, approved, verified Auditors who can access the expenditure. Validate that the expenditure belongs to the selected approved budget.
- Keep Auditor evidence separate from Treasurer submissions. Auditor files cannot replace or satisfy the Treasurer's required receipt and supporting-document categories.
- Store the expenditure and budget reference, filename, MIME type, size, uploader, upload time, explanation, and SHA-256 checksum with each file.
- Use a separate private evidence collection or storage structure. Treasurer files are embedded in the expenditure document and already have a storage limit; avoid interfering with Treasurer corrections or MongoDB document-size limits.
- Make evidence append-only in the initial version. For an incorrect file, add another with an explanation; retain the existing file and history.
- Allow an authorized Auditor to attach evidence regardless of the expenditure's current review status. An upload does not change the review decision, financial amounts, budget reservations, or AI assessment.
- Apply the existing authorized-reader policy for downloads, with server-side budget and expenditure checks. Return metadata without file bytes in ordinary API responses.

## File handling

- Reuse existing file-content validation and protected download behavior.
- Support PDF, DOCX, JPG, and PNG, matching existing expenditure evidence types.
- Limit each upload to five files, 5 MB per file and 10 MB combined. The separate cumulative Auditor evidence limit is 50 files and 50 MB per expenditure.
- Require an explanation for the uploaded batch.
- Enforce extension, MIME, and content-signature checks; do not expose public file URLs.

## Interface and audit history

- Display the upload action only to an authorized Auditor in expenditure details.
- Show filename, explanation, uploader, upload date, and download action for each Auditor file.
- Add an `audit_evidence_uploaded` expenditure history event identifying the Auditor and evidence references.
- Save the evidence records and history entry consistently: a failed batch must leave no partial evidence or misleading history entry.
- Update the Audit Review Report to distinguish Auditor evidence from Treasurer documents. The report lists file metadata rather than embedding documents.

## Existing workflow compatibility

- Preserve Treasurer correction uploads, versions, and limits.
- Keep manual and CSV expenditure submission flows unchanged. Attach Auditor evidence to the selected individual expenditure, including a CSV-created expenditure.
- Do not send uploaded file contents to the AI integrity checker; the Auditor reviews documents manually.
- Preserve review statuses, budget reservations, financial totals, and prior AI assessment when files are added.

## Completion checks

- [x] An authorized Auditor can upload and download evidence for the selected expenditure.
- [x] A Treasurer or ordinary official cannot use the Auditor upload endpoint.
- [x] A file cannot be accessed through a different budget or expenditure ID.
- [x] Invalid file types, oversized files, and uploads without an explanation are rejected.
- [x] A failed batch leaves no partial evidence or misleading history entry.
- [x] Treasurer documents remain available and are clearly distinguished from Auditor evidence.
- [x] Uploading evidence leaves the review status, amounts, annual budget, and AI results unchanged.
- [x] The Audit Review Report includes the Auditor evidence inventory.
- [x] Existing Treasurer submissions, corrections, downloads, and Auditor decisions continue to work.
- [x] Test the complete workflow with Treasurer and Auditor accounts in an isolated environment before using real records.

Implemented and verified on 2026-10-27. Validation: 78 backend tests passed
(three opt-in integration suites skipped in that run), 20 separate expenditure and
report integration checks passed against an isolated local MongoDB replica set,
frontend tests and production build passed, and Firefox fixture workflows passed
for Treasurer submissions/CSV imports and Auditor uploads, downloads and review.
Browser layout checks passed at widths from 320 to 1440 pixels. Real authenticated
fixture accounts exercised the HTTP API; browser checks used a fixture server.
No production records or running deployment were modified. The build retains its
pre-existing CSS syntax warning.
