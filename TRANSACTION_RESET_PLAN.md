# ChainShield MongoDB Transaction Reset Plan

Date: 23 October 2026

## Goal and status

Remove all transaction records from the selected ChainShield MongoDB database, including staged, archived, verified, pending, rejected and flagged records, after making and proving a restorable backup. Preserve accounts, authentication settings and unrelated application data.

This document is a plan only. No live database was accessed, no backup was created, and no records were deleted. Implement and rehearse the procedure before running it against the intended database.

Source reviewed: Pitz1600/ChainShield, branch `system-and-interface-improvements`, commit `aef77556d95570040a220ec2fcf28c8288d017b8`. The deployed schema and database name must be checked before execution; they may differ from this branch.

## 1. What the code shows

| Source | Finding and consequence |
| --- | --- |
| `backend/models/Transaction.js` | A single Transaction model holds staged and archived records, statuses, line items, budgets, risk results and blockchain references. Delete every document, without status or archive filters. |
| `backend/models/Alert.js` | Alerts reference `transactionId` and hold transaction hashes and analysis. Include transaction alerts in the reset. |
| `backend/models/Feedback.js` | Feedback can contain `transactionRef` and a copied `transactionMeta` snapshot. Clearing only the reference leaves transaction data behind. |
| `backend/models/AuditLog.js` | Logs can contain transaction IDs, feedback IDs and arbitrary details. They use a hash chain; selective deletion or editing can disrupt that chain. |
| `backend/models/Complaint.js` | No explicit transaction reference is defined. Preserve complaints unless runtime inspection establishes a transaction-specific record that belongs in scope. |
| `backend/config/database.js` | Application connection uses `MONGODB_URI`. Resolve the target explicitly; never silently fall back to a default database. |
| `backend/scripts/backup.sh` | Existing backup uses mongodump, an encrypted tar bundle and a checksum. Its printed restore directory is incorrect: the dump is inside `<backup_name>_staging/db/`. Upload resolution depends on the working directory, and automatic retention could remove recovery copies. |
| `reset_transactions.py` | Existing reset deletes transactions without a backup gate and also changes auditor account password requirements. It contains a hardcoded database credential. Do not reuse or execute it for this operation; rotate that exposed credential and move connection configuration out of source. |

## 2. Define the complete deletion scope

Build a dry-run manifest from the actual database, not just model filenames. Confirm actual collection names through model collection mappings and MongoDB collection inventory.

- **Transactions:** all documents, including archived and staged entries.
- **Alerts:** all transaction alerts, including orphaned legacy alerts. The reviewed model requires a transaction reference; verify that the deployed collection is not also used for unrelated alerts.
- **Feedback:** transaction-linked records and transaction snapshots, including legacy records with a missing reference. Include their embedded replies. Preserve general feedback with no transaction content.
- **Other collections:** identify transaction copies, import batches, approval records, cases, training examples, cached summaries and references by ObjectId, business transaction ID or hash. These are inspection targets, not claims that all exist. Specify exact filters and affected IDs for every additional collection; do not delete unknown collections wholesale.
- **Audit history:** handle explicitly as described below.
- **Preserved data:** users, roles, passwords, trusted devices, tokens, configuration, inflation/reference data, unrelated feedback, complaints and unrelated model metadata.

Capture transaction ObjectIds, business IDs and hashes before deletion to locate dependent records. Protect this manifest like a backup. Inspect legacy and free-text snapshots as well as schema-defined references. Any unexplained transaction-bearing collection blocks completion.

### Audit-history decision

For a normal operational reset, retain historical audit logs and append a `db_reset` event. This removes operational transactions but is **not literal removal of every transaction reference from MongoDB**.

For this request's literal “every transaction data” goal, move the complete pre-reset audit history into the verified external backup and start a new audit-history epoch only after the database owner has reviewed this scope. The audit collection contains unrelated security history too; therefore it must not be silently cleared as a side effect. Preserve the old chain intact in the backup, record its terminal hash in the external reset report, and write a fresh reset event containing counts and backup identifier only—not transaction IDs or contents. If this broader audit-history reset is not selected, explicitly report the retained transaction history as an exception; do not claim complete removal.

## 3. Implement a guarded maintenance tool

Proposed deliverables:

1. `backend/scripts/reset-transactions.js`: dry run by default, explicit database/cluster guard, collection inventory, dependency manifest, backup/restore verification gate, deletion and post-checks.
2. Improve `backend/scripts/backup.sh`: explicit target database, working-directory-independent paths, restrictive file permissions, failure cleanup and a protected pre-reset backup that is excluded from retention deletion.
3. `backend/scripts/verify-reset-backup.js`: compare restored data, collection counts, indexes and dependency coverage against the pre-reset manifest.
4. `backend/scripts/restore-reset-backup.sh`: documented restore into an isolated destination first, with explicit source and destination checks.
5. Tests and a short operator runbook.

The reset tool must require an explicit execute flag and exact database-name confirmation for its destructive mode. Bind execution to the reviewed manifest and backup checksum. Abort if the target, collection inventory or data changes between review and execution. Never log the URI/password. Never invoke `dropDatabase()` or drop operational collections; keep indexes and validators. No user or authentication updates belong in this tool.

## 4. Freeze writes and capture the baseline

1. Record the intended environment, cluster identity, database name, deployment commit and operator. Verify against the running application's configuration without printing credentials.
2. Stop all application writers, CSV imports, background jobs, blockchain synchronization, seed processes and training jobs that write to MongoDB. Keep writes stopped through backup, restore rehearsal, reset and verification.
3. Prevent non-application writers and inspect scheduled/TTL deletions that could change documents during verification. A maintenance banner alone does not freeze the database.
4. Record counts, collection options and indexes; per-status and archived/staged transaction counts; dependency counts; and protected collection content digests. Keep a digest of the exact pre-reset transaction/dependency document set, not counts alone.
5. Produce the manifest and review the audit-history scope. Do not proceed with unresolved collections or active writers.

## 5. Create a full, protected database backup

Back up the **entire selected application database**, not only transactions. This preserves references and enables recovery from an incomplete reset.

- Use MongoDB Database Tools `mongodump` to produce BSON plus collection metadata/index definitions, or a binary archive with compression. CSV export is not the recovery backup.
- Supply the database explicitly and check that it agrees with the configured target. Use a protected tools configuration file or secure credential mechanism; do not embed credentials in scripts, command history or reports.
- Run against the frozen database. Do not assume a normal dump taken during concurrent writes is a consistent snapshot.
- Encrypt the resulting backup; keep its decryption key separately. Use owner-only permissions for plaintext staging and handle failure cleanup.
- Record timestamp, source identity, database, tool/server versions, collection counts, archive size and SHA-256 checksum. Keep two verified copies in separate locations outside the database and Git repository.
- If uploads are needed for recovery, include the actual configured uploads directory. MongoDB backup alone does not contain external files.
- Exclude this backup from routine retention cleanup until recovery has been validated and the owner intentionally releases it.

## 6. Prove recovery before allowing deletion

1. Verify both backup copies' checksums.
2. Decrypt and restore into a fresh, isolated MongoDB instance compatible with the source version. The safest rehearsal uses the same database name on a completely different instance with no production access.
3. Point `mongorestore` at the actual dump directory or archive. For the existing tar format, use the extracted `<backup_name>_staging/db/` directory—not the path currently printed by the backup script.
4. Require a successful restore with zero failures and the expected nonzero counts where the source had data. Exit success alone is insufficient: an incorrect namespace can restore zero documents.
5. Compare all collection counts, indexes/options and canonical document digests, preserving BSON types and IDs. Check representative staged, archived and verified transactions plus alerts and feedback relationships.
6. Save the restore verification report and bind it to the exact backup checksum. Only a passed rehearsal enables destructive mode.

## 7. Perform the scoped reset

Keep the application offline. Use exact reviewed collection names and manifest-based filters.

1. Delete dependent transaction data first: alerts, transaction-specific feedback/snapshots and any additional approved dependencies.
2. Delete every document from the transaction collection with an intentionally empty filter on that explicitly selected collection. Do not apply normal UI filters that exclude staged or archived data.
3. Apply the separately reviewed audit-history policy. Do not selectively rewrite hash-chained entries and present them as unchanged history.
4. Record each step, expected count and acknowledged actual count in an external execution report. Keep a reset event without copied transaction payloads.
5. On the deployed topology, use a multi-document transaction only if supported and practical for the data volume. Otherwise use a restartable, checkpointed maintenance sequence; do not pretend sequential deletes are atomic. On any failure, stop and keep writes disabled while recovering or resuming from verified checkpoints.

## 8. Verify the empty state before reopening

- Transaction collection count is exactly zero, including raw staged and archived queries.
- No transaction alerts, transaction feedback snapshots or other approved transaction-bearing records remain.
- Audit history matches the selected policy; any retention exception is explicitly documented.
- All protected collections have unchanged content, apart from the documented reset event/audit policy. Account roles and password settings remain unchanged.
- Operational indexes and collection options match the baseline.
- Transaction lists, staged review queues, archives, alerts, totals and analytics display correct empty states without crashes or stale transaction values.
- Check identifier generation and integrations for collisions with old blockchain records before creating new transactions.
- Re-enable services in stages and verify that importers, seeders and sync jobs do not repopulate old data.

MongoDB deletion does not erase blockchain entries, Neo4j data, exported CSVs, model artifacts or external caches. Inventory these boundaries and prevent replay into MongoDB. Any deletion of those systems is a separate scoped operation. Transaction data intentionally remains in the recovery backup.

## 9. Rollback procedure

If deletion or verification fails, keep all writers stopped. Retain the partial-reset execution report.

1. Verify/decrypt the exact pre-reset backup and restore it into a clean isolated instance/database.
2. Validate documents, references, indexes and protected accounts against the baseline.
3. Prefer switching the application to the verified restored database, with a controlled configuration change. Do not merge a whole-database restore blindly into a partly cleared database.
4. If restoring in place is necessary, explicitly replace only the affected namespaces from the backup and reconcile inserted reset events; review destructive restore options first. Do not use a broad `--drop` against an unverified target.
5. Restore associated external files if changed, validate application behavior, then reopen writes.

Writes created after reopening will not exist in the pre-reset backup. Capture and reconcile them separately before a later rollback; never silently overwrite them.

## 10. Acceptance tests

- Dry run makes no changes and reports all statuses, archives and dependencies.
- Wrong database/cluster, missing backup, bad checksum, incorrect key and failed/empty restore each block deletion.
- Linked, orphaned and metadata-only feedback/alerts are handled according to the manifest; unrelated records survive.
- A deliberate mid-reset failure leaves the application offline and can recover to the original baseline.
- Protected accounts and indexes are unchanged after reset.
- A fresh transaction can be created in the rehearsal environment after reset without replaying old records or colliding with external history.
- Final report demonstrates zero scoped transaction records and a successful full recovery rehearsal.

## References

- Repository: https://github.com/Pitz1600/ChainShield/tree/aef77556d95570040a220ec2fcf28c8288d017b8
- MongoDB mongodump: https://www.mongodb.com/docs/database-tools/mongodump/
- MongoDB mongorestore: https://www.mongodb.com/docs/database-tools/mongorestore/
