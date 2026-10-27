import { useState } from 'react';
import { expendituresAPI as api } from '../../services/api';

export default function AuditorEvidence({ budgetId, expenditure, canUpload, busy, run, reload }) {
  const [open, setOpen] = useState(false), [files, setFiles] = useState([]), [explanation, setExplanation] = useState('');
  const evidence = expenditure.auditorEvidence || [];
  const bytes = files.reduce((n, f) => n + f.size, 0);
  const invalid = files.length > 5 || bytes > 10 * 1024 * 1024 || files.some(f => f.size > 5 * 1024 * 1024 || !/\.(pdf|docx|jpe?g|png)$/i.test(f.name));
  const full = evidence.length + files.length > 50 || evidence.reduce((n, f) => n + f.bytes, 0) + bytes > 50 * 1024 * 1024;
  return <section className="expenditure-detail-section">
    <h4>Auditor’s supporting evidence</h4>
    {!evidence.length && <p>No Auditor evidence uploaded.</p>}
    {evidence.map(f => <div className="bp-card expenditure-document" key={f._id}>
      <strong className="expenditure-document-name">{f.originalName}</strong><p>{f.mimeType} · {Math.ceil(f.bytes / 1024)} KB</p>
      <p>{f.explanation}</p>
      <p>Uploaded by {f.uploaderName || f.uploadedBy} at {new Date(f.uploadedAt).toLocaleString()}</p><p className="expenditure-checksum"><span>SHA-256</span><code>{f.sha256}</code></p>
      <button disabled={busy} onClick={() => run(async () => {
        const r = await api.downloadAuditEvidence(budgetId, expenditure._id, f._id);
        const url = URL.createObjectURL(r.data), link = document.createElement('a');
        link.href = url; link.download = f.originalName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Download Auditor evidence</button>
    </div>)}
    {canUpload && <>
      <button type="button" disabled={busy} onClick={() => setOpen(!open)}>Upload Audit Evidence</button>
      {open && <form onSubmit={event => { event.preventDefault(); if (!files.length || invalid || full || !explanation.trim()) return; run(async () => {
        const data = new FormData(); files.forEach(f => data.append('evidence', f)); data.append('explanation', explanation);
        await api.uploadAuditEvidence(budgetId, expenditure._id, data);
        setFiles([]); setExplanation(''); setOpen(false); await reload();
      }); }}><fieldset disabled={busy}>
        <legend>Upload Audit Evidence</legend>
        <p>PDF, DOCX, JPG/JPEG or PNG. Up to five files, 5 MB each and 10 MB per upload. Maximum 50 files and 50 MB per expenditure. Files are retained permanently; explain any replacement in a new upload.</p>
        <label>Choose Auditor evidence<input type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e => { const chosen = Array.from(e.target.files); setFiles(v => [...v, ...chosen]); e.target.value = ''; }} /></label>
        {files.map((f, i) => <div key={i}>{f.name} <button type="button" onClick={() => setFiles(v => v.filter((_, j) => i !== j))}>Remove {f.name}</button></div>)}
        <label>Explanation of relevance<textarea required maxLength={4000} value={explanation} onChange={e => setExplanation(e.target.value)} /></label>
        {invalid && <p role="alert">Choose up to five supported files, 5 MB each and 10 MB combined.</p>}
        {full && <p role="alert">This upload exceeds the 50-file or 50 MB expenditure limit.</p>}
        <button className="bp-primary" disabled={!files.length || invalid || full || !explanation.trim()}>Save Audit Evidence</button>
        {busy && <p role="status">Saving audit evidence…</p>}
      </fieldset></form>}
    </>}
  </section>;
}
