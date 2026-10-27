# Annual Proposal Budget Plan

## Goal

Add one annual budget pool for proposals, managed by the Municipal DILG administrator. Use the pool to limit proposal approvals in ChainShield while retaining the existing proposal, expenditure, and audit workflow.

This is a plan only. Implementation must first inspect the current `revisions` branch and reuse existing models, permissions, screens, and approved-amount fields where appropriate.

## Meaning of the pool

The pool represents the portion of the barangay budget available for proposals monitored by ChainShield. It must be supported by the applicable budget document. Do not automatically treat the entire annual barangay budget as available for proposals.

Recording a pool does not enact a budget, certify cash availability, or represent a bank deposit. The administrator manages the system record; official budget authorization and municipal review remain outside the application.

ChainShield checks the overall proposal budget ceiling. Authorized officials remain responsible for checking each proposal's permitted purpose and supporting authority. Separate appropriation limits are not automated in this scope.

## 1. Annual Budget page

Provide one Annual Budget page with one pool per fiscal year for the barangay covered by the system.

| Field | Requirement |
| --- | --- |
| Fiscal year | Required; identify the year covered by the pool |
| Budget available for proposals | Required; valid nonnegative peso amount |
| Supporting document/reference | Required basis for the recorded amount; retain the document or its traceable reference |
| Remarks | Optional explanation |

Reuse the application's existing document handling where suitable. Do not build a new document management module.

## 2. Budget figures

Display the following on the Annual Budget page and existing proposal review screen:

- Total proposal budget
- Reserved for approved proposals
- Available for proposals

**Available for proposals = Total proposal budget - Reserved for approved proposals**

Use budget-monitoring labels. Do not label these figures as cash available, bank balance, or formal accounting obligations.

No separate provisions, funding categories, charts, or bank balances are required.

## 3. Proposal submission

Retain the existing Captain proposal form and workflow.

- Identify the annual pool using the proposal's fiscal year.
- Draft and submitted proposals do not reserve funds.
- Permit submission before a pool is recorded, but clearly state that approval requires a recorded pool.
- Do not add a budget-provision selector or another proposal breakdown.

## 4. Approval and reservation

On approval, the backend must verify that:

1. A pool exists for the proposal's fiscal year.
2. The year has completed reconciliation of existing approved proposals.
3. The proposal is still eligible for approval.
4. The final approved amount is valid and fits within the available balance.

Approval and reservation must succeed together. Use an atomic database operation or transaction appropriate to the existing database setup. A frontend balance check alone is insufficient.

Prevent repeated clicks, request retries, and simultaneous approvals from reserving funds twice or exceeding the pool. Use consistent peso precision in comparisons and calculations.

| Action | Expected result |
| --- | --- |
| Record a PHP 1,000,000 pool | PHP 1,000,000 available |
| Approve a PHP 700,000 proposal | PHP 300,000 available |
| Attempt approval of a PHP 400,000 proposal | Blocked; explain the available amount |
| Approve a PHP 300,000 proposal | PHP 0 available |
| Reject a pending proposal | No balance change |

Reuse the existing final approved-amount field. Determine the authoritative approved status from the current implementation before integrating the calculation.

## 5. Stability of approved proposals

- Prevent ordinary edits to an approved proposal's amount or fiscal year.
- Do not add cancellation, reopening, amendment, or reservation-release workflows.
- Inspect existing edit, archive, and status actions and guard any action that would invalidate an existing reservation.
- Archiving an approved proposal must not remove its reservation.

## 6. Expenditure and audit workflow

The Treasurer continues recording expenditures against an approved proposal. The Auditor continues the existing review process.

Annual reservations remain based on the approved proposal amount. Expenditures do not deduct from the annual pool a second time.

| Example | Amount |
| --- | --- |
| Approved proposal reservation | PHP 100,000 |
| Expenditure recorded against the proposal | PHP 30,000 |
| Annual pool reservation remains | PHP 100,000 |

Do not automatically return unspent amounts to the pool. Do not change the existing AI checking, receipt handling, or expenditure verification workflow as part of this feature.

## 7. Pool adjustments

Allow the administrator to correct the pool or record a documented budget change.

Record the following for each adjustment:

- Previous amount and new amount
- Reason
- Supporting reference
- Administrator identity and timestamp

Block reductions below existing reservations, including when an adjustment and proposal approval happen concurrently. Keep a simple adjustment history within the Annual Budget page. Do not add a separate history module or a pool deletion action.

## 8. Existing records and rollout

Back up affected database records before migration or reconciliation. Retain a restoration procedure before enabling the new checks.

For each fiscal year:

1. Identify all existing approved proposals, including archived approved proposals.
2. Calculate their total using the authoritative approved amounts.
3. Identify missing fiscal years, invalid amounts, and inconsistent statuses.
4. Preserve existing proposals, receipts, expenditures, and audit records.
5. Have the administrator record the supported pool amount.
6. Enable new approvals only after the year's reservations are reconciled.

If records are incomplete or reservations exceed the recorded pool, show the discrepancy and block new approvals for that year until resolved. Do not invent allocations, silently edit historical records, or automatically reject historical approvals.

## 9. Access control

| Existing role | Access |
| --- | --- |
| Municipal DILG administrator | Record and adjust pools; review and approve proposals |
| Captain | View relevant budget figures and submit proposals |
| Treasurer | View figures alongside existing expenditure work |
| Auditor | View figures alongside existing audit work |

Enforce permissions and the applicable barangay scope in the backend. Reuse existing roles and permissions; do not introduce new government roles or account types.

## 10. Essential verification

Verify that:

- Unauthorized users cannot create or adjust a pool.
- Duplicate pools for the same barangay and fiscal year are prevented.
- Approval without a recorded or reconciled pool is blocked.
- Approval within the balance and approval for the exact balance succeed.
- Over-budget approval fails with a clear explanation.
- Repeated requests and concurrent approvals cannot overcommit funds.
- Concurrent adjustment and approval preserve the budget limit.
- Recording or auditing expenditures does not deduct from the pool again.
- Reductions below reservations fail.
- Approved amounts and fiscal years cannot be changed through ordinary editing.
- Archived approved proposals remain included.
- Existing approved proposals are counted correctly.
- Fiscal years maintain independent balances.

## Scope boundary

### Included

- One Annual Budget page
- One annual proposal pool per barangay and fiscal year
- Three budget-monitoring figures
- Backend approval and reservation checks
- Controlled pool adjustments and embedded history
- Existing-data reconciliation, backup, and essential verification

### Excluded

- Separate budget provisions or automated statutory allocation calculations
- Council enactment or municipal budget review screens
- Bank integration, deposits, cash tracking, or reconciliation
- New procurement, accounting, printing, or reporting modules
- AI changes
- Proposal cancellation, amendment, reopening, or automatic return of unused funds
- New government roles or general interface redesign

## Resulting workflow

Official budget authorization outside ChainShield → administrator records the supported annual proposal pool → Captain submits a proposal for that fiscal year → administrator reviews and approves within the pool limit → Treasurer and Auditor continue the existing expenditure workflow.
