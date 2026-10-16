export default function VerificationHistory({ transaction }) {
  return <dl className="verification-history">
    <dt>Verification status</dt><dd>{transaction.verificationStatus || 'Pending'}</dd>
    <dt>Reviewed by</dt><dd>{transaction.verifiedBy || '—'}</dd>
    <dt>Reviewed at</dt><dd>{transaction.verifiedAt ? new Date(transaction.verifiedAt).toLocaleString() : '—'}</dd>
    {transaction.isArchived && <>
      <dt>Archived by</dt><dd>{transaction.archivedBy || '—'}</dd>
      <dt>Archived at</dt><dd>{transaction.archivedAt ? new Date(transaction.archivedAt).toLocaleString() : '—'}</dd>
    </>}
  </dl>;
}
