import { useState } from 'react';

export default function TransactionReference({ value }) {
  const [message, setMessage] = useState('');
  return <div className="transaction-reference">
    <strong>Transaction reference</strong>
    <div style={{ overflowWrap: 'anywhere' }}>{value || '—'}</div>
    <p>A unique reference used to find this record and trace its audit history.</p>
    {value && <button type="button" onClick={async () => {
      try { await navigator.clipboard.writeText(value); setMessage('Reference copied.'); }
      catch { setMessage('Unable to copy. Select and copy the reference above.'); }
    }}>Copy reference</button>}
    <span role="status">{message}</span>
  </div>;
}
