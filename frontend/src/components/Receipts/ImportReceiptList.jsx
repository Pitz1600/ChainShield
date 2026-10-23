import { useEffect, useState } from 'react';
import { Download, FileText, Paperclip } from 'lucide-react';
import { receiptApi } from '../../services/api';
import './Receipt.css';
export default function ImportReceiptList({ transactionId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    receiptApi.list(transactionId).then(r => { if (active) setData(r.data.group); })
      .catch(() => { if (active) setError('Unable to load receipts.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [transactionId]);
  async function view(receipt) {
    setOpening(true); setError('');
    try {
      const response = await receiptApi.file(data.importId, receipt.receiptId);
      // Authorized download avoids rendering active PDF content in the application.
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = receipt.originalName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Unable to download receipt.'); }
    finally { setOpening(false); }
  }
  return <section className="receipt-panel" aria-label="CSV supporting receipts">
    <div className="receipt-heading"><span className="receipt-heading-icon"><Paperclip size={20} aria-hidden="true" /></span><div><h3>Supporting receipts</h3><p>Files attached to this CSV import</p></div></div>
    {error && <p className="receipt-message receipt-message-error" role="alert">{error}</p>}
    {loading ? <p className="receipt-empty" role="status">Loading receipts…</p> : !data ? <p className="receipt-empty">No CSV-level receipts available for this transaction.</p> : <>
      <p className="receipt-source"><strong>Source CSV:</strong> {data.sourceCsvName}</p>
      <p className="receipt-context">These files support the CSV upload containing this transaction; they are not individually verified evidence for this row.</p>
      {!data.receipts.length && <p className="receipt-empty">No receipts attached to this CSV import.</p>}
      <ul className="receipt-file-list">{data.receipts.map(r => <li key={r.receiptId}>
        <FileText className="receipt-file-icon" size={22} aria-hidden="true" />
        <div className="receipt-file-details"><strong>{r.originalName}</strong><span>{r.mimeType === 'application/pdf' ? 'PDF' : 'Image'} · {new Date(r.uploadedAt).toLocaleDateString()}</span></div>
        <button className="receipt-button receipt-download" disabled={opening} onClick={() => view(r)} aria-label={`Download ${r.originalName}`}><Download size={16} aria-hidden="true" /><span>Download</span></button>
      </li>)}</ul>
    </>}
  </section>;
}
