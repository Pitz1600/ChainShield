# ChainShield — Financial Report Printing Implementation Plan

## Goal and reviewed baseline

Implement this revision: **“Provide printing functionality for the Barangay Auditor and Barangay Treasurer to generate financial figures, summaries, and reports.”**

Reviewed `Pitz1600/ChainShield`, branch `revisions`, at commit [`99eb8e978917652c7e1a78a34033e5ad12c0035d`](https://github.com/Pitz1600/ChainShield/commit/99eb8e978917652c7e1a78a34033e5ad12c0035d), “Apply revisions,” committed October 26, 2026, 3:29 PM Philippine time. This was the latest branch head retrieved for this review. The supplied Repo.txt points to an older branch; this plan follows the explicitly requested `revisions` branch.

This is an implementation plan, not a completed feature. Findings are based on source inspection; the application and production database were not run or changed.

## 1. What already exists and what is missing

| Existing implementation | Implication for printing |
| --- | --- |
| `ApprovedBudgets.jsx` displays approved proposals, allocations, recorded submissions, pending amounts, verified spending, remaining balances, evidence, and review history. | Reuse its terminology and provide report entry points here. It currently has evidence-download controls but no financial print workflow. |
| `BudgetProposal` stores fiscal year, proposal number, barangay label, allocation items and integer-centavo approved totals. | Use approved proposal records as the source of approved allocations. |
| `BudgetExpenditure` stores amounts, allocation references, human-review status, evidence versions, review history and an optional linked `Transaction`. | Use expenditures as the financial source; transaction linkage supplies references and assessment details, not an additional expense. |
| `budgetExpenditurePolicy.totals()` already distinguishes verified, pending and available amounts. | Preserve these definitions and add explicit rejected totals. |
| `budgetExpenditures.js` limits its approved-budget list to 200 proposals. Transaction lists are also paginated. | Reports must query all matching records independently; printing the loaded screen would produce incomplete reports. |
| `getBudgetSummary()` sums `Transaction.approvedBudget` across transactions. | Do not use this as the approved-budget total: several expenditure transactions can repeat the same allocation amount. |
| Frontend and backend permission matrices give `generate_reports` to auditors and administrators, but not barangay officials. | Add a position-aware Treasurer capability without granting printing to every barangay official. |
| `budgetProposalPolicy.js` explicitly defines one deployment as one barangay. | Preserve this deployment model; do not invent per-user tenant restrictions based on optional user fields. |

There is no dedicated report page or report API in the inspected reporting, transaction, budget, navigation and server paths. A permission named `generate_reports` does not itself implement report generation.

## 2. Recommended first release

Build one **Financial Reports** page with three templates, a preview, and **Print / Save as PDF** using the browser print dialog. No new PDF-generation service is necessary for this release.

| Report | Audience | Required content |
| --- | --- | --- |
| Budget and Expenditure Summary | Treasurer, Auditor, Administrator | Fiscal year, proposal/allocation, approved amount, verified amount, submitted amount, correction-required amount, rejected amount, reserved amount and available balance. |
| Expenditure Register | Treasurer, Auditor, Administrator | Expenditure reference, date, proposal number, allocation, purpose, payee, amount, human-review status, linked transaction reference and evidence availability. Include status subtotals. |
| Audit Review Report | Auditor, Administrator | Expenditure register fields plus reviewer, review date, decision/reason, evidence inventory/version, assessment availability and clearly separate AI risk indicators. Optional detailed history appendix. |

The first release covers the new approved-budget expenditure workflow end to end. A legacy Transaction Register can follow as a separate report; do not merge legacy and expenditure totals to imply a complete cashbook. Historical transaction reporting is not required to deliver the three templates above.

Do not label these reports audited financial statements, bank balances, proof of disbursement, legal appropriations, or prescribed government forms. Use “System-recorded financial report.” Preserve the existing distinction between administrative budget approval and legal authorization. Printing must never approve, verify, publish, archive, or run an AI assessment.

## 3. Financial and filtering rules

### Source and arithmetic

For each selected approved proposal/allocation, calculate in integer centavos:

```text
approved = approved proposal/allocation amount, counted once
verified = sum(amountCentavos where reviewStatus = verified)
submitted = sum(amountCentavos where reviewStatus = submitted)
correctionRequired = sum(amountCentavos where reviewStatus = correction_required)
pendingReserved = submitted + correctionRequired
rejected = sum(amountCentavos where reviewStatus = rejected)
allRecorded = verified + pendingReserved + rejected
available = approved - verified - pendingReserved
utilizationPercent = verified / approved * 100, when approved > 0
```

- Rejected submissions remain visible in records but do not consume available allocation. Display zero-budget utilization as N/A.
- Never sum `Transaction.amount` on top of the linked expenditure amount. Never sum repeated `Transaction.approvedBudget` fields.
- Group allocations by proposal ID plus allocation ID, not allocation names.
- Cross-check each proposal total against its item amounts. Surface missing allocations, invalid money, orphan links and inconsistent totals as data issues; do not silently fabricate zero values or repair records during report generation.
- Format PHP with two decimals only at display time. Guard sums against unsafe integers.
- Print missing AI assessments as “Pending” or “Unavailable,” never as “Low risk.” Human verification and AI risk are separate columns.

### Filters and date semantics

- Require fiscal year; permit a specific approved proposal and allocation. Derive available fiscal years and proposal options from actual authorized data.
- Budget Summary is a **current snapshot for selected fiscal-year budgets**, using all expenditure records associated with those budgets. Disable expenditure date/status filters for its balance calculations.
- Expenditure Register permits an expenditure-date interval and human-review status. Audit Review Report additionally permits review-date filtering; label the selected date basis clearly.
- Interpret selected dates in `Asia/Manila`, converting to an inclusive start and exclusive next-day boundary in UTC. Do not use the server timezone implicitly.
- Period/status-filtered rows and subtotals must match exactly. If a register includes budget summary cards, label them “Current full-budget balances — not limited to this period/status.”
- Review status is the current status at generation, not the status at the historical period end. Historical balance reconstruction is outside this release; a cutoff on dates alone cannot recreate old review states.
- Archived linked transactions must not erase real expenditure amounts from budget reports. Treat archive/publication state as transaction metadata; use expenditure review status for budget arithmetic.
- Use stable sorting: expenditure date then ID, or review date then ID for review-date reports. State filters and ordering in the report header.

## 4. Backend implementation

### Capability policy

Create `backend/services/reportPolicy.js` and use existing authentication middleware. Require completed onboarding, an active account, verification and approval as enforced by auth plus report policy.

- Treasurer: `role === 'barangay_official'` and trimmed, case-insensitive position `Barangay Treasurer`, matching `budgetExpenditurePolicy.treasurer()`.
- Auditor: authenticated approved/verified `auditor`.
- Administrator: retain administrative reporting access already represented in the permission matrix.
- Other officials, including Captains, are denied unless requirements are explicitly expanded later.
- Return capabilities from the server; enforce every report type there. Do not add `generate_reports` indiscriminately to the whole `barangay_official` role.
- Respect `BUDGET_EXPENDITURES_ENABLED` for all expenditure report endpoints. A disabled module must return an explicit unavailable response, not an empty financial statement.

Retain the configured single-barangay deployment scope. Resolve the configured label through the existing policy, validate requested proposal IDs against that scope and approval status, and reject arbitrary client-provided scope. If historical records have a different label after a configuration change, surface the mismatch for administrator resolution; do not silently mix barangays. Multi-barangay authorization is a separate prerequisite if the deployment model changes.

### Proposed API

Create `backend/routes/reports.js`, mounted at `/api/reports` in `backend/server.js`:

| Endpoint | Responsibility |
| --- | --- |
| `GET /access` | Available report types and enabled state for the signed-in user. |
| `GET /options?fiscalYear=...` | Authorized fiscal years, proposals and allocation choices; use real pagination where necessary. |
| `POST /preview` | Validate report type and filters, build the complete report payload, and record generation metadata. Use existing CSRF handling. |

Create `backend/services/financialReportService.js` for normalized filters, record selection, joins, calculations and a strict response field allowlist. Reuse shared total rules instead of copying conflicting formulas into components.

Response contract: `reportId`, `templateVersion`, `generatedAt`, `timezone`, authenticated `generatedBy`, deployment label, normalized filters, date/status basis, record count, summary, allocation totals, rows and data-quality notices. Return no evidence binaries, authentication fields, arbitrary model documents or raw storage paths.

Read relevant proposals, expenditures and needed transaction/user fields in one database snapshot using the replica-set transaction support already required by expenditures. Compute rows and summaries from that same snapshot. Fail explicitly if a consistent read cannot be obtained; do not claim historical or snapshot consistency from an arbitrary timestamp alone.

Do not reuse the 200-proposal list or loop through frontend transaction pages. Set a documented initial maximum of 5,000 detail rows and a response-size limit. If exceeded, return a clear error asking the user to narrow filters; never truncate and label the result complete. Avoid N+1 queries and exclude large history arrays unless a requested appendix needs them.

### Audit event

Add `financial_report_generated` to the `AuditLog.action` enum. Record actor, report ID/type, template version, normalized filters, count and generation time using the established audit mechanism. Do not store report rows, receipt files or personal payee details in the log.

Log generation after successful validation and report construction. The existing audit helpers swallow failures, so inspect the write outcome and expose an appropriate operational warning rather than claiming every generation was logged. A browser cannot reliably confirm physical printing: neither `afterprint` nor closing the dialog proves success. Do not log “printed successfully.”

## 5. Frontend and printable layout

Create:

- `frontend/src/components/Reports/FinancialReports.jsx`: report selection, filters, loading/error states and preview controls.
- `frontend/src/components/Reports/FinancialReportPreview.jsx`: shared report header, summaries, tables, notes and signature spaces.
- `frontend/src/components/Reports/Reports.css`: screen and print styles.
- `reportsAPI` methods in `frontend/src/services/api.js` using the existing authenticated client.

Integrate `/dashboard/reports` into the path-to-view and navigation mappings in `MainLayout.jsx`; add **Financial Reports** to `Sidebar.jsx` based on server capabilities. Add **Print budget report** and **Print expenditure register** shortcuts in `ApprovedBudgets.jsx` that preselect the current proposal. Use the application's existing view-switching pattern rather than assuming each screen is independently declared in App.jsx.

Workflow: select template → select filters → Generate preview → inspect totals/rows → Print / Save as PDF. Keep the generated response frozen for that preview. Changing filters marks it stale and disables Print until regeneration; do not mix a new header with old rows. Cancel outdated requests. Do not poll or regenerate while the print dialog is open.

Render ordinary escaped React text, not HTML assembled from descriptions or names. Revalidate access before printing a long-lived preview, clear report state on logout/session expiry, and use private/no-store responses. Never cache financial payloads in localStorage or put report data in URLs.

Print requirements:

- Dedicated report surface in the current page; call `window.print()` only after it is ready. No popup dependency.
- `@media print` hides sidebar, top bar, filters, action buttons, interactive overlays and unrelated content. Remove scroll-container heights/overflow that would clip rows.
- A4 portrait for summaries; landscape for wide registers, with readable margins and minimum readable type size. Repeat table headers and avoid splitting ordinary rows; allow exceptionally long content to flow instead of disappearing.
- Black text on white, status words readable without background colors, wrapped descriptions and long references, PHP/₱ glyph support.
- Header includes ChainShield, configured barangay identity, report title/ID, fiscal year, filters, generation time in Philippine time, generator and report basis.
- Footer/signature area includes Prepared by and, where appropriate, Reviewed by, with blank signature/date spaces. Never fabricate signatures or claim a reviewer approved the whole report because they reviewed one entry.
- Summary totals and detailed row subtotals must remain legible across pages. Do not promise cross-browser automatic page X of Y; verify browser pagination and headers separately.
- Empty data prints “No matching records” with valid zero totals where appropriate. Loading, failed, incomplete or inconsistent financial payloads must not be printable as valid reports.

Evidence remains an inventory: filename, category, version and reference, plus optional checksum in the audit appendix. Do not auto-download or embed receipt images, PDFs or DOCX files. Receipt attachment printing is a separate enhancement.

## 6. Database impact and rollout

No migration, deletion, reseeding or rewriting of financial data is required. Existing proposals, expenditures, transactions, evidence, review histories and ML datasets remain unchanged. New report-generation events are the only intended persisted records; add the audit action enum. No Report collection is needed for this first release, and report IDs do not imply stored/retrievable snapshots.

Use snapshot transactions read-only against financial collections. Add query indexes only if measured query plans justify them; candidate fields include proposal fiscalYear/status and expenditure budgetProposalId/reviewStatus. `input.timestamp` is currently mixed/string data, so validate and normalize its comparison in the reporting layer; do not assume a Date index or mass-convert existing data without a separate plan.

Roll out backend policy/service and tests first, then report UI and print styles, then enable navigation after verification. Validate on a backed-up staging database with fabricated fixtures; use the existing backup workflow before production deployment. Rollback disables report access/removes the new UI and route; it does not revert or delete financial records or audit events.

## 7. Validation and acceptance criteria

1. **Access:** Treasurer and Auditor can generate their permitted templates; Administrator retains access. Captain, other officials, unauthenticated, unapproved, disabled and incomplete-onboarding accounts cannot bypass controls with a direct API request. Test feature flag off and out-of-scope IDs.
2. **Accounting fixture:** approved PHP 100,000; verified PHP 20,000; submitted PHP 10,000; correction-required PHP 5,000; rejected PHP 7,000. Expected recorded PHP 42,000, pending/reserved PHP 15,000, available PHP 65,000 and utilization 20%. Linked Transaction copies must not change any total.
3. **Allocation and year:** repeated allocation names, two proposals sharing a fiscal year, another fiscal year, zero-spend budgets and multiple expenses against one allocation produce correct totals without repeating approved amounts.
4. **Dates and statuses:** Philippine midnight boundaries, leap day, reversed/invalid intervals, review-date versus expenditure-date filters, pending corrections and current-status disclosure are correct. Date-limited registers cannot misstate full-budget balances.
5. **Completeness:** more than 200 proposals and more than 500 transactions/expenditures are represented when matching and within limits. Over-limit reports fail explicitly. Concurrent review changes cannot produce inconsistent summary and row totals.
6. **Evidence and malformed data:** retained evidence versions, missing assessment, missing reviewer, orphan reference, long strings and HTML-like text render safely. Evidence binary content never appears in the report JSON.
7. **Printing:** visually inspect a short summary and multi-page register in Chromium and Firefox print preview/Save as PDF. Check clipping, repeated headers, totals, empty reports, ₱ signs, grayscale, long descriptions and both orientations. Open representative saved PDFs to verify actual output, not only CSS emulation.
8. **No side effects:** generating, printing or cancelling a report changes no financial document, approval, reservation, assessment or publication state. Verify generation audit events separately; do not require or claim a physical-print event.

Suggested automated files: `backend/test/financialReports.test.js`, `backend/test/financialReports.integration.test.js`, and a focused browser report-check script following the repository's existing scripts. Run backend and frontend `npm test`, frontend `npm run build`, and the relevant expenditure integration/browser regression checks. Document pre-existing failures separately. None of these checks have been run as part of this planning-only task.

## 8. Implementation order

1. Confirm data contract and financial fixture; implement report policy and shared calculation service.
2. Add authorized, consistent report endpoints, field allowlists, limits and generation audit events.
3. Build the three templates and navigation/approved-budget shortcuts.
4. Add print CSS and browser Print / Save as PDF behavior.
5. Complete accounting/access tests and real multi-page print verification; deploy without financial data migration.

Defer downloadable server-rendered PDFs, Excel exports, scheduled reports, saved historical snapshots, receipt bundles and legacy transaction reporting until this first release is accepted.

## Source references

All paths below are pinned to the reviewed commit:

- [Approved Budgets UI](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/frontend/src/components/Expenditures/ApprovedBudgets.jsx)
- [Expenditure routes](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/routes/budgetExpenditures.js)
- [Expenditure policy and totals](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/services/budgetExpenditurePolicy.js)
- [Proposal policy and single-barangay scope](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/services/budgetProposalPolicy.js)
- [BudgetProposal model](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/models/BudgetProposal.js)
- [BudgetExpenditure model](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/models/BudgetExpenditure.js)
- [Transaction controller and legacy summary](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/controllers/transactionController.js)
- [Backend permissions](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/middleware/roleMiddleware.js)
- [AuditLog model](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/backend/models/AuditLog.js)
- [MainLayout navigation](https://github.com/Pitz1600/ChainShield/blob/99eb8e978917652c7e1a78a34033e5ad12c0035d/frontend/src/components/Layout/MainLayout.jsx)
