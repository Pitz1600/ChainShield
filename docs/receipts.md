# Local CSV receipts

Each new successful CSV import records an independent UUID manifest in
`backend/local-receipts/imports/`, even with no attachments. Legacy transactions
are deliberately ungrouped. Receipt operations use read-only database queries;
no model fields or database settings are added. The existing authenticated staff
transaction detail policy allows officials, administrators and auditors to read
staged and archived records; receipts follow that same policy. Auditors cannot
upload attachments.

Use Attach Receipts (Optional) below Upload & Analyze to queue up to ten JPG,
PNG or PDF files (10 MB each, 30 MB total). Changing the selected CSV clears the
queue. After import, select an exact upload in history to add files later. Failed
attachment uploads can be retried for the returned import ID without importing
transactions again. Files use an authenticated download fallback.

The backend nodemon configuration ignores `local-receipts/**` so writing a
manifest does not restart the development server during an upload. If overriding
the storage location inside the backend directory, add that location to the
nodemon ignore list too; an external directory is preferable.

Storage defaults to a backend-relative path, independent of launch directory.
Set RECEIPT_STORAGE_DIR to an absolute persistent private directory to override.
Do not put it beneath uploads or another publicly served directory. The default
Docker Compose backend bind mount persists the default directory on the host.
Before running Docker, create backend/local-receipts and grant the backend's
UID/GID 1001:1001 write access (or configure an equivalent private mounted
storage directory). Docker image ownership cannot override host bind-mount
permissions. The backend reports storage failures separately from CSV success.
Docker runtime permissions have to be checked on the deployment host.

Back up the entire receipt directory separately while the backend is stopped;
restore manifests and files together. Git ignores the default directory and
branch switches leave it in place. Do not use git clean on ignored data.
Separate backend installations do not share receipts. Run one backend writer
process per storage directory: receipt additions are serialized per import
within that process and manifests are replaced atomically.

If manifest initialization fails after CSV persistence, the response retains
CSV success and supplies receiptStoreError. Do not re-import. Restore storage
access and use the exact returned transaction IDs for administrator-assisted
local manifest recovery; never infer groups from filenames or row values.

Tests use temporary filesystem storage and mocked database reads/writes to
check isolation, validation, roles, authenticated downloads and absence of
presence/audit writes. A full before/after snapshot of every collection in a
seeded disposable MongoDB, a comparison to baseline CSV-import writes, and a
Docker restart/browser acceptance run remain deployment verification steps;
these tests must never target the real defense database.
