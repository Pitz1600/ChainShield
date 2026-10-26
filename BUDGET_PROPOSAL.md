# ChainShield — Budget Proposal Submission and Review (revisions branch)

**Plan only — no application code, routes, or database records changed.**  
**Repository:** `Pitz1600/ChainShield`, branch `revisions` (inspected 2026-10-26).  
**Priority:** add useful proposal content and a functional submission/review workflow inside the **existing** application. **Do not redesign the dashboard, sidebar, theme, transaction pages, or add pie charts.**

## 1. Goal and workflow

A Barangay Captain creates a proposal, adds one or more expenditure/project items with practical spending details, optionally attaches cost estimates/quotations, saves a draft, and submits it to the Administrator. The Administrator reads the submitted proposal and **approves, rejects, or (optional) returns for revision** with an explanation. Both parties can view status and history.

`Draft → Submitted/Pending Review → Internally Approved | Rejected`  
Optional: `Submitted → Needs Revision → Revised Draft → Resubmitted` (preserve every submitted version).

**Domain boundary:** ChainShield administrative approval is an *internal system decision*, **not** legal budget enactment, procurement award, receipt of cash, transfer of funds, or disbursement. Formal barangay enactment and city/municipal review are outside this MVP. Do not label it simply “funds approved for release.”

## 2. Verified repository integration points

Source files examined directly on `revisions`:

- `frontend/src/App.jsx`: authentication, session handling, and `/dashboard/*` routing.
- `frontend/src/components/Layout/MainLayout.jsx`: maps `/dashboard/...` paths to views; renders lazily imported modules in existing `content-area`, `TopBar`, `Sidebar` and error boundary.
- `frontend/src/components/Layout/Sidebar.jsx`: role-based existing navigation; add one `Budget Proposals` navigation item using current icons/stylesheet patterns.
- `frontend/src/services/api.js`: Axios API module with cookie credentials and CSRF acquisition for modifying requests; extend with `budgetProposalsAPI` rather than introduce a second HTTP client.
- `backend/server.js`: registers `/api/...` route modules, existing CSRF, rate limiter, authentication and audit middleware; mount `/api/budget-proposals` here.
- `backend/models/User.js`: available `role` values: `barangay_official`, `administrator`, `auditor`; the `position` field is a string. **There is currently no independent `barangay_captain` role**.
- `backend/middleware/roleMiddleware.js`: `requireRole`, `requireAdmin`, `requireOfficial`, `requirePermission`; add proposal-specific permission checks without granting submission rights to every official.
- `backend/routes/transactions.js`: transaction CRUD/import/approval and `/budget-summary` already exist. **Do not reuse transaction approve** for budget proposal approval.
- `backend/models/AuditLog.js`: existing audit logger with action enumerations and `logAction` method; ensure new proposal event actions fit its model; maintain detailed separate proposal history if necessary.
- `README.md`: transactions already support CSV and procurement line items, and backend supports authenticated uploaded files. **Budget proposals are not equivalent to transactions.**

The existing `docs/SCHEMA.md` can be outdated relative to models (it mentions a resident role absent in the currently inspected `User.js`); source code wins.

### Integration file plan (suggested paths, create only where absent)
- `frontend/src/components/BudgetProposals/BudgetProposalsPage.jsx`: proposal list / My Proposals / Pending Review based on permissions.
- `frontend/src/components/BudgetProposals/BudgetProposalForm.jsx`: focused create/edit page.
- `frontend/src/components/BudgetProposals/BudgetProposalDetails.jsx`: read-only detail and admin decisions.
- `frontend/src/components/BudgetProposals/BudgetProposalForm.css`: minimal scoped styling relying on existing design tokens/components.
- Edit `MainLayout.jsx` path-to-view and lazy view mapping; edit `Sidebar.jsx` nav entry; extend `frontend/src/services/api.js`.
- `backend/models/BudgetProposal.js`, `backend/routes/budgetProposals.js`, `backend/controllers/budgetProposalController.js` and optionally `backend/models/BudgetProposalEvent.js`.
- Edit `backend/server.js` to mount new router; extend `roleMiddleware.js` and audit handling as needed.
- Add tests under existing `backend/test/` and `frontend/test/` patterns.

## 3. Captain submission page — exact content requirements

**Single focused page inside the existing application layout**, using simple sections and optional collapsible details. No progress stepper required; no donut/pie chart; no analytics dashboard on this screen.

### A. Proposal Details (top of form)
| Field | Required? | Behavior |
|---|---|---|
| Proposal title | Yes | Plain text, e.g. “Barangay Road Repair and Street Lighting” |
| Fiscal year | Yes | Valid year, e.g. 2027 |
| Proposal type | Yes | Annual / Supplemental (internal categorization only) |
| Program/sector | Yes | Infrastructure, Health, Education, Sanitation, Other (configurable) |
| Purpose / justification | Yes | Multiline explanation: what problem is addressed and why the funds are needed |
| Barangay | Automatic | From verified user assignment; display read-only. **Repository currently lacks a verified barangay association in `User.js`: implement a trusted assignment or single-barangay configuration before accepting submissions.** |
| Submitted by | Automatic | Server identifies creator, do not trust form input |

### B. Project / Expenditure Items (repeatable cards — core feature)

Use an **Add Project Item** button. Each item is a small card, not a complex spreadsheet. Required fields:

| Field | Required? | Notes |
|---|---|---|
| Item / activity name | Yes | “Road repair materials”, “Streetlight installation”, “Labor costs” |
| Description / spending purpose | Yes | **What exactly the money will buy or pay for**, e.g. “100 bags Portland cement, 10 m³ gravel and 8 m³ sand for repairs on X road”; free text lets Captain add specifics without dozens of inputs |
| Estimated amount (PHP) | Yes | Positive monetary amount; compute overall total server-side |
| Proposed supplier / payee | No | “ABC Hardware Supply” or “To be determined”; do not imply awarded contract |
| Supplier location / address | No | Known location for price reference, not mandatory at planning stage |
| Expected timeline | No | Month, quarter or expected completion date |
| Additional details | No | Free-text notes such as specifications, quantity, unit prices, rationale, delivery plan |

Provide a **Remove item** action for unsent drafts; confirm deletions. The sum of all item estimated amounts appears as **Total Proposed Amount** in a simple line at the bottom. An optional future version may add structured quantity/unit/unit-price subfields, but **do not require them for MVP**.

**Example**

- Proposal: Barangay Infrastructure Improvements; FY 2027; Infrastructure; purpose: improve roads and lighting.
- Item 1: Road repair materials; description: cement, gravel, sand and reinforcing steel for Barangay Pantal road repairs; ₱150,000; proposed supplier: To be determined; timeline: Q1 2027; notes: refer to uploaded cost estimate.
- Item 2: Street lighting installation; description: supply and installation of 30 LED streetlights; ₱200,000; proposed supplier: To be determined; timeline: Q2 2027; notes: LED rating and pole requirements in attached specification.
- **Total proposed amount:** ₱350,000.

This is enough detail for an administrator to know *where money is intended to go* while remaining quick to fill out. Do not demand a finalized supplier before procurement.

### C. Supporting Documents (bottom of form)

- Button/drag area to attach **PDF, DOCX, XLSX, JPG or PNG** (examples: cost estimate, proposed material list, sketch, quotation, indicative PPMP, BAIP reference).
- Support **multiple** attachments; show file name/type/size and remove action before submission.
- Optional for a basic internal draft; administrator can ask for missing evidence during review.
- Allow secure authenticated download by authorized users. Validate real MIME/content, extension, count, per-file size, safe storage names and ownership; never expose uploads to arbitrary users. Reuse established upload conventions when feasible, but confirm authorization for each file.
- **No CSV import in MVP**: the Captain uses the form directly. CSV import may be added later as a convenience for bulk items. Do not force uploading an official form when the proposal is entered in the app.

### D. Actions (bottom)
- **Save as Draft**: saves partial valid data, editable later.
- **Review & Submit**: shows a simple confirmation summary (title, fiscal year, items, total, attached files), then **Submit Proposal**.
- Success screen/toast with generated proposal number and **Pending Review** status.
- Disable duplicate submission while request is in flight; server also protects against double submit.
- When a submitted proposal opens in Captain view, show a read-only copy and current decision/rejection reason.

### Essential validation
- Submission requires title, fiscal year, proposal type, sector, justification, >=1 item with name, purpose and positive amount; total must be within a configured policy limit if one exists.
- Draft saving can have relaxed rules but never persist malformed amounts/oversized strings.
- Server recomputes total from item amounts; prefer integer centavos or Decimal128, not floating point rounding.
- Reject unauthorized edits to any submitted/reviewed proposal; edits to drafts only.

## 4. Administrator view — content, not redesign

A `Budget Proposals` entry should route Admins to a simple table with columns: proposal number, barangay, Captain, title, fiscal year, total amount, submission date, status, **View**. Default filter: **Pending Review**; optional filters: status/year.

**Details page** shows:
1. Proposal heading and `Pending Review` status.
2. Submitted by, barangay, dates, fiscal year, type and sector.
3. Purpose / justification (full text).
4. Item cards containing description, proposed supplier, estimated amount, timeline and additional details.
5. Total proposed amount.
6. Supporting documents (authenticated view/download).
7. Review history and status changes.
8. Buttons: **Approve** and **Reject**. Reject must request a nonempty explanation. Optional **Return for Revision** with remarks.

Approval label and audit event should explicitly mean **administrative review approved**. Captain sees reviewed status and remarks in `My Proposals`. Avoid charts and budget analytics in this view.

## 5. Authorization / role fit

The `revisions` branch stores `role='barangay_official'` and a free-form `position`, not `barangay_captain`. Protect proposal submission by a **server-controlled Captain entitlement**. Preferred: a normalized approved position code / capability such as `submit_budget_proposals` assigned by Admin to the Captain, while retaining current `barangay_official` role. Do not trust arbitrary `position` text from registration or request body for privileged access. Existing Admin user may review/approve but cannot create Captain submissions by default. Auditors can be granted read-only access later.

For multiple barangays, add verified barangay assignment and scope listings/documents to that barangay; never trust a client-provided barangay ID. If the app currently serves one barangay, use an explicit server-managed configuration and preserve room for future expansion.

## 6. New data model (separate from transactions)

`budget_proposals`:
```js
{
  proposalNumber: 'BP-2027-0001',
  barangayId: /* trusted barangay ref/config */,
  createdBy: /* User ObjectId */,
  title: 'Barangay Infrastructure Improvements',
  fiscalYear: 2027,
  proposalType: 'annual',
  sector: 'infrastructure',
  justification: '...',
  items: [{
    itemId: /* stable embedded id */,
    name: 'Road repair materials',
    description: 'Cement, gravel, sand, steel ...',
    estimatedAmountCentavos: 15000000,
    proposedSupplier: null,
    supplierAddress: null,
    expectedTimeline: 'Q1 2027',
    additionalDetails: '...'
  }],
  totalAmountCentavos: 35000000, // recalculated on backend
  documents: [{ fileId, storageKey, originalName, mimeType, bytes }],
  status: 'DRAFT', // DRAFT|SUBMITTED|ADMIN_APPROVED|REJECTED|NEEDS_REVISION (optional)
  revision: 1,
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  reviewerRemarks: null,
  legalAuthorizationStatus: 'NOT_RECORDED',
  createdAt, updatedAt
}
```

Create a `budget_proposal_events` append-only history (actor, status transition, version, time, remarks, snapshot hash / payload metadata). Also log actions via the existing `AuditLog.logAction()` path, **extending permitted action enums if necessary**. Preserve submitted snapshots / versions for audit and never silently overwrite approved/rejected submissions.

**Existing transaction collection remains unchanged** for the MVP. Do not create a transaction, alter `budget-summary`, credit the barangay account, or train AI on approved proposals. Procurement and actual disbursements are later distinct events.

## 7. API proposal — use existing Express conventions

| Endpoint | Allowed actor | Use |
|---|---|---|
| `POST /api/budget-proposals` | Captain | Create draft |
| `GET /api/budget-proposals` | Captain / Admin | Scoped own list or admin queue |
| `GET /api/budget-proposals/:id` | Scoped reader | Detail with item cards |
| `PATCH /api/budget-proposals/:id` | Captain owner | Edit draft |
| `POST /api/budget-proposals/:id/documents` | Captain owner | Add supporting document to draft |
| `DELETE /api/budget-proposals/:id/documents/:fileId` | Captain owner | Remove draft document |
| `GET /api/budget-proposals/:id/documents/:fileId` | Authorized | Secure document download |
| `POST /api/budget-proposals/:id/submit` | Captain owner | Draft → Submitted |
| `POST /api/budget-proposals/:id/approve` | Admin | Submitted → Admin Approved |
| `POST /api/budget-proposals/:id/reject` | Admin | Submitted → Rejected, reason required |
| `GET /api/budget-proposals/:id/history` | Authorized | Events |

Use existing authentication, cookie CSRF, rate limiting, field validation and error-handling patterns. Make decisions atomic and conditional on current `status`+`revision` (prevent competing decisions). Maintain audit consistency using MongoDB session/transaction when available. Return 403 for unauthorized, 404 for inaccessible/missing, 409 for stale transitions, 422 for invalid submissions.

## 8. Minimal navigation integration

- Add `Budget Proposals` sidebar entry in `Sidebar.jsx`, visible to eligible Captain and Admin roles (and optional read-only Auditor).
- Add `budget-proposals` to `MainLayout.jsx`'s `pathToView` / `viewToPath`, lazy load the new page, keep same `TopBar`, responsive layout, error boundary and styling.
- Child routes or internal component states should cover **My Proposals**, **Create/Edit**, **Proposal Details**, and Admin **Pending Review**. Ensure deep links work on refresh; don't return silently to Dashboard for an unrecognized child route.
- Add `budgetProposalsAPI` in existing `frontend/src/services/api.js`, using existing axios instance and CSRF handling.
- Do not add dashboard charts, a pie chart, a five-step wizard, or a redesigned navigation system.

## 9. Phased implementation

1. **Baseline and backup:** back up MongoDB, record current revision commit, test current login, transactions and budget summary. No seed scripts on non-disposable data.
2. **Identity and models:** trusted Captain permission / barangay scope, proposal document model, item schema, event log indexes.
3. **Backend endpoints:** draft CRUD, submit, admin decision, scoped reads; upload/download validation and storage.
4. **Submission form:** proposal details + repeatable item cards + document attachments + save/review/submit.
5. **Admin details:** queue, itemized read-only details, approve/reject remarks.
6. **Verification:** permissions, validation, attachment security, audit correctness, duplicate submissions, cross-barangay access and regression testing.

## 10. Completion checklist

- [ ] Authorized Captain can create, reopen and update drafts.
- [ ] Form captures project purpose, estimated amount and **where money is intended to be spent** (item narrative, potential supplier/location and notes).
- [ ] Multiple item cards can be added and removed, total recalculated correctly.
- [ ] Captain can optionally attach multiple appropriate documents and securely retrieve them.
- [ ] Save Draft preserves work; Submit validates, locks, timestamps, and shows Pending Review.
- [ ] Admin sees correct queue and full content without charts.
- [ ] Admin can approve/reject only once per submitted revision, with rejection remarks.
- [ ] Captain can view status and decision history, but cannot self-approve.
- [ ] Non-Captain officials are not automatically granted submission permission.
- [ ] Wrong-barangay / unauthorized attachment access is rejected.
- [ ] Existing transaction and budget summary behavior is unchanged.
- [ ] `npm --prefix backend test`, `npm --prefix frontend run lint`, and `npm --prefix frontend run build` pass (plus added new workflow tests).

## 11. Not in this implementation

Charts / pie breakdowns; CSV budget import; real procurement bidding/award; legal appropriation ordinance workflow; actual bank disbursements; automatic transaction creation; auto ML scoring of draft proposals; full PPMP generation; redesign of ChainShield screens. These are potential later releases, **not** prerequisites to submit a simple budget proposal.
