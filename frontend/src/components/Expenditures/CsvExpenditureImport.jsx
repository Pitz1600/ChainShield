import { useState } from 'react';
import { expendituresAPI as api } from '../../services/api';
const money = n => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n);
export default function CsvExpenditureImport({ budgetId, availableCentavos, onSaved, onBusyChange }) {
  const [csv, setCsv] = useState(null), [preview, setPreview] = useState(null), [rows, setRows] = useState([]);
  const [files, setFiles] = useState([]), [key, setKey] = useState(() => crypto.randomUUID());
  const [readingCsv, setReadingCsv] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState(0);
  async function run(fn) {
    if (busy) return;
    setBusy(true); onBusyChange(true); setError('');
    try { await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } finally { setBusy(false); onBusyChange(false); }
  }
  function loadCsv(chosen) {
    if (busy || !chosen) return;
    setCsv(chosen); setPreview(null); setRows([]); setKey(crypto.randomUUID()); setError('');
    if (!/\.csv$/i.test(chosen.name) || chosen.size > 2 * 1024 * 1024) {
      setError('Choose a CSV file no larger than 2 MB.');
      return;
    }
    setReadingCsv(true);
    run(async () => {
      try {
        const data = new FormData(); data.append('csvFile', chosen);
        const r = await api.previewCsv(budgetId, data);
        setPreview(r.data); setRows(r.data.rows.map(() => ({ evidenceIndexes: [] })));
      } finally { setReadingCsv(false); }
    });
  }
  const invalidFiles = !files.length || files.length > 20 || files.some(f => f.file.size > 5 * 1024 * 1024 || !/\.(pdf|docx|jpe?g|png)$/i.test(f.file.name)) || files.reduce((n, f) => n + f.file.size, 0) > 10 * 1024 * 1024;
  const requiredEvidence = indexes => indexes.some(i => files[i]);
  const overBudget = (preview?.rows || []).reduce((sum, row) => sum + Math.round(row.input.amount * 100), 0) > availableCentavos;
  const evidenceTooLarge = rows.reduce((sum, r) => sum + r.evidenceIndexes.reduce((n, i) => n + (files[i]?.file.size || 0), 0), 0) > 25 * 1024 * 1024;
  const complete = preview && rows.length && rows.every(r => requiredEvidence(r.evidenceIndexes)) && !invalidFiles && !overBudget && !evidenceTooLarge;
  return <section className="bp-card expenditure-csv"><h3>Upload Expenditure CSV</h3><p>Available budget balance: <strong>{money(availableCentavos / 100)}</strong>. All expenditures use this budget’s remaining balance.</p>
    <p>Use the same CSV format as the Integrity Checker, including Date, Agency, Program Name, Payer Name, Payee Name, Amount (or Debit Amount / Credit Amount), and Description. Up to 25 rows and 2 MB per CSV. Itemized columns are supported.</p>
    {error && <p role="alert" className="bp-error">{error}</p>}
    <button type="button" disabled={busy} onClick={() => run(async () => { const r = await api.template(); const url = URL.createObjectURL(r.data); const link = document.createElement('a'); link.href = url; link.download = 'expenditure_import_template.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}>Download CSV Template</button>
    <label>CSV file<input aria-label="Expenditure CSV file" type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { const chosen = e.target.files[0]; e.target.value = ''; loadCsv(chosen); }} /></label>
    <p>{csv ? `Selected file: ${csv.name}. ` : ''}Expenditures load automatically when you choose a CSV. Nothing is saved until you submit.</p>
    {readingCsv && <p role="status">Reading CSV and checking expenditures…</p>}
      <fieldset disabled={busy}><legend>Upload receipts and supporting documents</legend><p>Up to 20 files, 5 MB each and 10 MB combined. PDF, DOCX, JPG/JPEG or PNG. Upload your files, then select the relevant files for each expenditure row below.</p>
        <input aria-label="CSV expenditure evidence" type="file" multiple accept=".pdf,.docx,.jpg,.jpeg,.png" onChange={e => { const chosen = Array.from(e.target.files).map(file => ({ file })); setFiles(v => [...v, ...chosen]); e.target.value = ''; }} />
        {files.map((f, index) => <div className="bp-card expenditure-file" key={index}><strong>{index + 1}. {f.file.name}</strong> · {Math.ceil(f.file.size / 1024)} KB
          <button type="button" onClick={() => { setFiles(v => v.filter((_, i) => i !== index)); setRows(previous => previous.map(r => ({ ...r, evidenceIndexes: r.evidenceIndexes.filter(i => i !== index).map(i => i > index ? i - 1 : i) }))); }}>Remove</button>
        </div>)}
      </fieldset>
      {files.length > 0 && invalidFiles && <p role="alert" className="bp-error">Choose at most 20 PDF, DOCX, JPG or PNG files, 5 MB each and 10 MB combined.</p>}
    {preview && <><p>{preview.rows.length} expenditures found. Financial details are read from the CSV. All rows are charged to this approved budget. Select the relevant evidence for each row below. Nothing is recorded until you submit.</p>
      {files.length > 0 && <button type="button" disabled={busy || invalidFiles || !requiredEvidence(files.map((_, i) => i))} onClick={() => setRows(previous => previous.map(r => ({ ...r, evidenceIndexes: files.map((_, i) => i) })))}>These documents apply to every row</button>}
      <div className="bp-table"><table><thead><tr>{['CSV row', 'Date', 'Description', 'Payer / Payee', 'Amount', 'Evidence for this expenditure'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{preview.rows.map((row, index) => <tr key={row.rowNumber}><td>{row.rowNumber}{row.recordId && <small> · {row.recordId}</small>}</td><td>{new Date(row.input.timestamp).toLocaleDateString()}</td><td>{row.input.description}</td><td>{row.payer} → {row.payee}</td><td>{money(row.input.amount)}</td><td>{files.map((file, fileIndex) => <label className="bp-checkbox" key={fileIndex}><input disabled={busy} type="checkbox" checked={rows[index].evidenceIndexes.includes(fileIndex)} onChange={e => { const checked = e.target.checked; setRows(previous => previous.map((r, i) => i === index ? { ...r, evidenceIndexes: checked ? [...r.evidenceIndexes, fileIndex] : r.evidenceIndexes.filter(n => n !== fileIndex) } : r)); }} />{file.file.name}</label>)}{!requiredEvidence(rows[index].evidenceIndexes) && <span>Select at least one evidence file</span>}</td></tr>)}</tbody></table></div>
      {invalidFiles && <p>Attach accepted evidence files within the size limits.</p>}{evidenceTooLarge && <p role="alert">Batch evidence exceeds 25 MB across expenditures. Split the CSV into smaller batches.</p>}{overBudget && <p role="alert" className="bp-error">The batch exceeds the approved budget’s available funds.</p>}
      <p>The CSV financial rows are analyzed together by the existing Integrity Checker. Evidence is reviewed manually by the auditor.</p>
      {busy && <p role="status">Upload {progress}% · Submitting CSV expenditures and running integrity check…</p>}
      <button className="bp-primary" type="button" disabled={busy || !complete} onClick={() => run(async () => {
        const data = new FormData(); data.append('csvFile', csv); data.append('submissionKey', key); data.append('rows', JSON.stringify(rows));
        const used = new Set(rows.flatMap(r => r.evidenceIndexes));
        if (files.some((_, i) => !used.has(i))) throw new Error('Remove evidence files that are not assigned to any row before submitting.');
        files.forEach(f => data.append('evidence', f.file));
        await api.importCsv(budgetId, data, e => setProgress(e.total ? Math.round(e.loaded / e.total * 100) : 0)); await onSaved();
      })}>Submit CSV Expenditures &amp; Run Existing Integrity Check</button>
    </>}
  </section>;
}
