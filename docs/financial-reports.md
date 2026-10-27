# Financial reports

Open **Budgets** (officials) or **Approved Budgets** (auditors and administrators). Use **Print** beside **View Budget**, or **Print** inside the budget details. The print view stays within Budgets and locks the selected proposal and fiscal year. Choose a template and optional filters, generate a preview, then use **Print / Save as PDF**. Changing filters requires a new preview. Reports remain in component memory only; report IDs do not identify stored snapshots.

Approved, verified, active Treasurers can access summaries and registers. Auditors and Administrators also receive the audit template. Completed onboarding is required. All endpoints respect `BUDGET_EXPENDITURES_ENABLED=true`. The configured identity is `BUDGET_PROPOSAL_BARANGAY_ID` (default `single-barangay`). An approved budget with a different label blocks reports for administrator resolution.

`/api/reports/access`, `/options` and `/preview` use existing authentication and CSRF middleware. Options use 100-proposal pages. Preview requires a replica-set snapshot transaction and fails explicitly if one is unavailable. Up to 5,000 matching expenditures and 8 MiB serialized report content are supported; exceeding either limit requires narrower filters. Financial records are never rewritten. Only the generation audit event is created; a failed audit write is disclosed. Printing itself is not logged as successful.

Summary balances use all associated expenditures. Registers use expenditure dates, or review dates for audit reports, with inclusive Philippine dates and current review status. Rejected amounts do not reserve allocation. Linked transactions contribute references only. Unsafe amounts, missing allocations and inconsistent approved totals fail construction. Orphan transaction links are disclosed and prevent printing. Evidence is inventory only.

## Validation

- `cd backend && npm test`
- `cd frontend && npm test && npm run build`
- Set `EXPENDITURE_TEST_MONGODB_URI` to an isolated localhost replica-set database named `chainshield_expenditure_test_*`, then run `npm run test:reports:integration` and `npm run test:expenditures:integration` from `backend`. The tests delete **only that dedicated test database**.
- Build the frontend, then `node scripts/check-reports-browser.cjs`. Requires Firefox and Node with WebSocket support. Uses fabricated HTTP fixtures; creates summary/register PDFs under `/tmp/chainshield-report-*.pdf`.

Validated during implementation: backend/frontend unit suites, report and expenditure replica-set integrations, Firefox preview workflow and saved PDF rendering. Summary allocation blocks use portrait A4; registers use landscape A4, repeated table headers, and flowing long descriptions. Chromium print-dialog behavior still requires manual staging verification (Chromium is not installed in this workspace). The existing frontend build emits an unrelated CSS syntax warning.

Before production rollout, use the existing backup workflow and inspect representative reports in both target browsers on staging. No migration, reseed, new financial index or production deployment is part of this change.
