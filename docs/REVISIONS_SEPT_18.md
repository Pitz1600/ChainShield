# September 18 revisions

Source: `Revisions SEPT 18.xlsx`. Row numbers refer to the spreadsheet. Feedback code is preserved. Following approval, login/register left panels are removed in favor of centered forms.

| Row | Revision | Implementation |
| --- | --- | --- |
| 2 | Login/register left-panel content | Removed following approval: compact centered login and wider registration with two desktop columns, one mobile column, no logo or brand-name heading, and an email-verification/approval note. |
| 3 | One-step registration | One form containing personal details, role/position, and security fields; email verification and administrator approval retained. |
| 4 | Show password | Independent accessible Show/Hide buttons for password and confirmation. |
| 5 | Verification feedback | Local success/error messages, invalid-digit highlighting, request guards, and distinct network-error wording. |
| 6 | Logo above title | Portal sidebar uses a separate logo image with the title below; login/register branding was subsequently removed by request. |
| 7 | Ellipsis | Constrained summaries, filenames, and table descriptions truncate; full information remains in details or accessible text. |
| 8 | Icons only for actions | Decorative icons removed from active screens; action icons, branding, and data visualizations retained. Login/register left panels have been removed following approval. |
| 9 | Equal card sizes | Responsive grids stretch comparable cards to equal dimensions within their group. |
| 10 | Local refresh | Transaction table refresh fetches data without remounting the view, retaining filters, sorting, and valid pagination. Existing dashboard/session refresh actions already fetch data locally. |
| 11 | Verification column | Table shows status; reviewer/archive identity and timestamps are available in details. |
| 12 | Sidebar order | Dashboard, Transactions, Integrity Checker remain first. Feedback menu changes excluded. |
| 14 | Profile menu | Accessible Profile button replaces repeated name/role; profile page retains identity information. |
| 15 | Currency | Display peso amounts using ₱; retain stored/exported currency codes and respect other currencies. |
| 16 | Duplicate details | Rename Import Data to Transaction details, remove repeated AI/identity/item information from other tabs, and retain distinct analysis/breakdown/remarks content. |
| 17 | Title borders | Static title/summary surfaces lose button-like borders and hover effects; actionable cards remain interactive. |
| 18 | Transaction IDs | Hide IDs in history and checker tables; explain and allow copying full references in details, including auditor views. |
| 19 | Nearby filters | Search, dates, status, program, sort, and refresh controls are grouped directly above the table and remain visible for empty results. |
| 20 | Nearby errors | Shared field errors, local action feedback, and accessible transaction/checker/admin notifications. |
| 21 | Text limits | Active fields prevent typing/pasting beyond their limits; existing password/token compatibility is preserved. |
| 22 | Red invalid fields | Native and mapped API field errors have red borders, associated explanatory text, and first-error focus. |
| 25 | Template download limit | Five requests per authenticated account per ten minutes; HTTP 429 includes Retry-After and retryAfterSeconds. Client blocks duplicate in-flight requests and shows a retry countdown. |
| 26 | Manual pagination | Bounded numbered navigation, stable values, valid indices after deletion, first-invalid-row navigation, and clamped result pages after removals. |
| 27 | Empty-row prevention | Add another row requires every existing row to pass validation; a request guard prevents duplicate appends. |

## Interfaces and defaults

- Existing API paths, CSV columns, role permissions, approval requirements, and processing services are retained.
- New optional `Transaction.verifiedAt` records future review timestamps; existing records need no migration or backfill.
- Field-limit constants live inside each service so independent Docker builds remain supported. The frontend test checks that both copies agree when both service directories are available.
- Limits: first/last name 50; position and payer/payee names 100; agency/program 120; manual transaction description 500; complaint subject 200; email 254; search 200; other short text 255; long text 2,000. Complaint descriptions allow 2,000. Passwords and opaque tokens retain compatibility.
- Write endpoints reject over-limit values without truncating them. CSV/manual imports also validate their mapped transaction text before processing.
- Feedback routes, models, components, and styles are excluded.

## Validation

Run `npm --prefix backend test`, `npm --prefix frontend test`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build`.

Focused tests cover field boundaries, credential compatibility, CSV limits, manual-row validation, invalid dates, pagination clamping, account-isolated download limiting, retry metadata, and verification timestamps. The existing lint baseline contains unrelated failures, including a preserved feedback component; this revision does not suppress those rules.

The repeatable browser checks require Firefox and Node.js 22+: build the frontend, then run `npm --prefix frontend run test:browser` from the repository. They serve the production build with synthetic API responses, use a temporary Firefox profile, and write screenshots under `/tmp`; no live account or database is used. Build with `VITE_CAPTCHA_ENABLED=false` for these synthetic checks.

Completed verification: 34 backend tests and 8 frontend tests pass; the production build and all three synthetic browser scenarios pass. Mobile checks confirm no horizontal field overflow and bounded row navigation; desktop checks confirm separated logo/title and preserved table pagination on refresh. `git diff --check` passes. Lint still reports 30 existing errors and 2 existing warnings, down from the initial 64 errors and 4 warnings; feedback files remain unchanged.
