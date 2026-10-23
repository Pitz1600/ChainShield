import { useState } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { receiptApi } from '../../services/api';
import './Receipt.css';
// Kept mounted during analysis so queued files and exact retry target survive.
export default function ImportReceiptDialog({ file, queued, setQueued, imported, busy }) {
  const [expanded, setExpanded] = useState(false);
  const [groups, setGroups] = useState([]);
  const [target, setTarget] = useState('');
  const [laterFiles, setLaterFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  async function open() {
    setExpanded(!expanded);
    if (!expanded && !file) {
      try { setGroups((await receiptApi.history()).data.imports); }
      catch { setMessage('Unable to load CSV upload history.'); }
    }
  }
  function select(e) {
    const files = [...e.target.files];
    e.target.value = '';
    if (files.length > 10 || files.some(f => f.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|pdf)$/i.test(f.name)) || files.reduce((s, f) => s + f.size, 0) > 30 * 1024 * 1024) {
      setMessage('Select up to 10 JPG, PNG or PDF files, up to 10 MB each and 30 MB total.'); return;
    }
    setMessage('');
    if (file) setQueued(files); else setLaterFiles(files);
  }
  async function attach(id, files) {
    setSaving(true); setMessage('');
    try { await receiptApi.attach(id, files); setMessage('Receipts attached successfully.'); setLaterFiles([]); if (id === imported?.importId) setQueued([]); }
    catch (err) { setMessage(err.response?.data?.error || 'Receipt upload failed. Retry for the same selected CSV import.'); }
    finally { setSaving(false); }
  }
  return <div className="receipt-controls">
    <button type="button" className="receipt-button receipt-toggle" disabled={busy || saving} aria-expanded={expanded} onClick={open}><Paperclip size={18} aria-hidden="true" /> Attach Receipts (Optional)</button>
    {imported?.message && <p className="receipt-message" role="status">{imported.message}</p>}
    {imported?.importId && queued.length > 0 && !file && <button className="receipt-button" disabled={saving || busy} onClick={() => attach(imported.importId, queued)}>Retry receipts for {imported.sourceCsvName} ({imported.importId.slice(0, 8)})</button>}
    {expanded && <div className="receipt-panel">
      <div className="receipt-heading"><span className="receipt-heading-icon"><Paperclip size={20} aria-hidden="true" /></span><div><h3>Attach supporting receipts</h3><p>Add documents to your CSV upload</p></div></div>
      {file ? <p className="receipt-source">Will attach to: <strong>{file.name}</strong> after successful import</p> : <label>Choose CSV upload
        <select value={target} disabled={saving} onChange={e => { setTarget(e.target.value); setLaterFiles([]); }}>
          <option value="">Select an exact CSV import</option>
          {groups.map(g => <option key={g.importId} value={g.importId}>{g.sourceCsvName} · {g.importId.slice(0, 8)} · {new Date(g.uploadedAt).toLocaleString()} · {g.transactionCount} transactions</option>)}
        </select>
      </label>}
      <label className="receipt-upload"><Upload size={24} aria-hidden="true" /><strong>Choose supporting files</strong><span>JPG, PNG or PDF · Up to 10 files, 10 MB each, 30 MB total</span><input type="file" multiple accept=".jpg,.jpeg,.png,.pdf" disabled={busy || saving || (!file && !target)} onChange={select} /></label>
      <ul className="receipt-file-list">{(file ? queued : laterFiles).map((f, i) => <li key={`${f.name}-${i}`}><span className="receipt-queued-name">{f.name}<small>{(f.size / 1024 / 1024).toFixed(2)} MB</small></span> <button className="receipt-button receipt-remove" aria-label={`Remove ${f.name}`} disabled={busy || saving} onClick={() => file ? setQueued(queued.filter((_, j) => i !== j)) : setLaterFiles(laterFiles.filter((_, j) => i !== j))}><X size={16} aria-hidden="true" />Remove</button></li>)}</ul>
      {!file && <button className="receipt-button receipt-attach" disabled={!target || !laterFiles.length || saving} onClick={() => attach(target, laterFiles)}>{saving ? 'Attaching…' : 'Attach to selected CSV import'}</button>}
    </div>}
    {message && <p className="receipt-message" role="status">{message}</p>}
  </div>;
}
