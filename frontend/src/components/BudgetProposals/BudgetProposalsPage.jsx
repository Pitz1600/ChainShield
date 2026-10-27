import { useEffect, useState } from 'react';
import { FileText, Plus, Upload, ArrowLeft, FolderOpen, ClipboardCheck, Download, Eye } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { budgetProposalsAPI as proposals } from '../../services/api';
import YearPicker from '../Common/YearPicker';
import { BudgetFigures } from '../AnnualBudget/AnnualBudget';
import './BudgetProposalForm.css';
import './BudgetProposalAdmin.css';
const base = '/dashboard/budget-proposals';
const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format((cents || 0) / 100);
const statuses = { DRAFT: 'Draft', SUBMITTED: 'Pending Review', ADMIN_APPROVED: 'Internally Approved', REJECTED: 'Rejected' };
const blankItem = () => ({ name: '', description: '', estimatedAmountCentavos: 0, proposedSupplier: '', supplierAddress: '', expectedTimeline: '', additionalDetails: '' });
const blank = () => ({ title: '', fiscalYear: new Date().getFullYear() + 1, proposalType: 'annual', sector: 'infrastructure', justification: '', items: [blankItem()], documents: [], status: 'DRAFT' });
export default function BudgetProposalsPage({ user }) {
  const location = useLocation(), navigate = useNavigate();
  const route = location.pathname.slice(base.length).replace(/^\//, '');
  const admin = user?.role === 'administrator';
  const [access, setAccess] = useState(null), [rows, setRows] = useState([]), [proposal, setProposal] = useState(null);
  const [status, setStatus] = useState(admin ? 'SUBMITTED' : ''), [year, setYear] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [review, setReview] = useState(false);
  const [files, setFiles] = useState([]), [remarks, setRemarks] = useState('');
  useEffect(() => { let active = true; proposals.access().then(r => { if (active) setAccess(r.data); }).catch(e => setError(e.response?.data?.error || e.message)); return () => { active = false; }; }, []);
  useEffect(() => {
    let active = true;
    setReview(false); setFiles([]); setProposal(null); setError('');
    if (!access || !(access.canReview || access.canSubmit)) return;
    if (route === 'new' && (admin || !access.canSubmit)) return;
    const request = !route ? proposals.list({ status, year }) : route === 'new' ? Promise.resolve({ data: blank() }) : proposals.get(route);
    request.then(r => { if (active) { if (route) setProposal(r.data); else setRows(r.data); } }).catch(e => { if (active) setError(e.response?.data?.error || e.message); });
    return () => { active = false; };
  }, [route, access, status, year, admin]);
  async function run(fn) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }
  async function save() {
    let current = (await (proposal._id ? proposals.save(proposal._id, proposal) : proposals.create(proposal))).data;
    setProposal(current);
    if (files.length) { current = (await proposals.upload(current._id, files, current.revision)).data; setFiles([]); setProposal(current); }
    return current;
  }
  const canCreate = !admin && access?.canSubmit;
  const editable = proposal?.status === 'DRAFT' && canCreate;
  const total = proposal?.items.reduce((n, item) => n + item.estimatedAmountCentavos, 0) || 0;
  const update = (key, value) => setProposal(p => ({ ...p, [key]: value }));
  const field = (key, label, multiline = false) => <label className="bp-wide" key={key}>{label}{multiline ? <textarea maxLength={key === 'justification' ? 10000 : 4000} value={proposal[key] || ''} disabled={!editable || busy} onChange={e => update(key, e.target.value)} /> : <input maxLength="200" value={proposal[key] || ''} disabled={!editable || busy} onChange={e => update(key, e.target.value)} />}</label>;
  return <section className={`budget-proposals${admin ? ' bp-admin' : ''}`}>
    <header className="bp-page-header"><span className="bp-header-icon"><FileText size={25} aria-hidden="true" /></span><div><h1>Budget Proposals</h1><p>Approval confirms the proposal review. It does not release funds.</p></div></header>
    {error && <p role="alert" className="bp-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {!access ? <p>Loading access…</p> : !(access.canSubmit || access.canReview) ? <p>Email verification is complete, but budget submission requires an administrator-approved Barangay Captain account. Ask your administrator to confirm your Captain position in Admin Panel → User Management. Explicitly disabled submission access must be re-enabled there.</p> : !route ? <>
      <div className="bp-queue-header"><div><span className="bp-eyebrow">{admin ? 'ADMINISTRATIVE REVIEW' : 'BUDGET PLANNING'}</span><h2>{admin ? 'Review Budget Proposals' : 'My Proposals'}</h2>{admin && <p>Review the Captain’s proposed spending and supporting documents, then record your decision.</p>}</div>{admin && <span className="bp-queue-icon"><ClipboardCheck size={32} aria-hidden="true" /></span>}</div>
      {canCreate && <div className="bp-upload-entry"><span className="bp-entry-icon"><Upload size={24} aria-hidden="true" /></span><div><h3>Submit a Proposed Budget</h3><p>Create your proposal, add project items, and upload cost estimates, quotations or other supporting files before submitting it for review.</p><button className="bp-primary" onClick={() => navigate(`${base}/new`)}><Plus size={18} aria-hidden="true" /> Create Budget Proposal &amp; Upload Documents</button></div></div>}
      <section className="bp-queue-panel"><div className="bp-panel-heading"><h3>{admin ? 'Proposal Review Queue' : 'Proposal Records'}</h3><span>Filter by status or fiscal year</span></div><div className="bp-actions bp-filters"><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><YearPicker value={year} onChange={setYear} clearable placeholder="All years" /></div>
      <div className="bp-table"><table><thead><tr>{['Proposal number', 'Captain', 'Title', 'Fiscal year', 'Total', 'Submitted', 'Status', 'Action'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(p => <tr key={p._id}><td>{p.proposalNumber}</td><td>{p.createdBy?.firstName} {p.createdBy?.lastName}</td><td>{p.title || 'Untitled draft'}</td><td>{p.fiscalYear}</td><td>{money(p.totalAmountCentavos)}</td><td>{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : '—'}</td><td><span className={`bp-status bp-status-${p.status.toLowerCase()}`}>{statuses[p.status]}</span></td><td><button className="bp-view-button" onClick={() => navigate(`${base}/${p._id}`)}><Eye size={15} aria-hidden="true" /> {admin ? 'Review' : 'View'}</button></td></tr>)}</tbody></table>{!rows.length && <div className="bp-empty"><FolderOpen size={32} aria-hidden="true" /><h3>No proposals found</h3><p>{canCreate ? 'Create your first proposal or choose a different filter.' : 'Submitted proposals will appear here for review.'}</p></div>}</div></section>

    </> : route === 'new' && !canCreate ? <p>Proposal creation and uploads are available only to an authorized Barangay Captain. <button onClick={() => navigate(base)}>Back to review queue</button></p> : !proposal ? <p>Loading proposal…</p> : <>
      <button className="bp-back" onClick={() => navigate(base)}><ArrowLeft size={16} aria-hidden="true" /> Back to proposals</button><div className="bp-proposal-heading"><h2>{proposal.proposalNumber || 'New Proposal'}</h2><span className={`bp-status bp-status-${proposal.status.toLowerCase()}`}>{statuses[proposal.status]}</span></div>
      <p>Submitted by: {proposal.createdBy?.firstName ? `${proposal.createdBy.firstName} ${proposal.createdBy.lastName}` : `${user.firstName} ${user.lastName}`} </p>
      <p>Submitted: {proposal.submittedAt ? new Date(proposal.submittedAt).toLocaleString() : 'Not submitted'} · Reviewed: {proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleString() : 'Not reviewed'}</p>
      <BudgetFigures fiscalYear={proposal.fiscalYear} refresh={proposal.revision} />
      {proposal.reviewerRemarks && <p><strong>Review remarks:</strong> {proposal.reviewerRemarks}</p>}
      {editable && !review && <a href="#budget-proposal-uploads">Upload supporting documents</a>}
      {admin ? <>
        <section className="bp-card bp-readonly"><div className="bp-section-title"><FileText size={19} aria-hidden="true" /><h3>Proposal Details</h3></div><h2>{proposal.title || 'Untitled proposal'}</h2>
          <dl className="bp-metadata"><div><dt>Fiscal year</dt><dd>{proposal.fiscalYear || '—'}</dd></div><div><dt>Proposal type</dt><dd>{proposal.proposalType || '—'}</dd></div><div><dt>Program / sector</dt><dd>{proposal.sector || '—'}</dd></div></dl>
          <div className="bp-narrative"><h4>Purpose / justification</h4><p>{proposal.justification || 'Not provided'}</p></div>
        </section>
        <div className="bp-section-heading"><h3>Project / Expenditure Items</h3><span>{proposal.items.length} {proposal.items.length === 1 ? 'item' : 'items'}</span></div>
        {proposal.items.map((item, index) => <article className="bp-card bp-reviewed-item" key={item.itemId || index}>
          <div className="bp-reviewed-item-heading"><div><span className="bp-eyebrow">PROJECT ITEM {index + 1}</span><h3>{item.name || 'Unnamed item'}</h3></div><strong>{money(item.estimatedAmountCentavos)}</strong></div>
          <div className="bp-narrative"><h4>Spending purpose</h4><p>{item.description || 'Not provided'}</p></div>
          <dl className="bp-metadata"><div><dt>Proposed supplier / payee</dt><dd>{item.proposedSupplier || 'To be determined'}</dd></div><div><dt>Supplier location</dt><dd>{item.supplierAddress || 'Not provided'}</dd></div><div><dt>Expected timeline</dt><dd>{item.expectedTimeline || 'Not provided'}</dd></div></dl>
          {item.additionalDetails && <div className="bp-narrative"><h4>Additional details</h4><p>{item.additionalDetails}</p></div>}
        </article>)}
      </> : <>
      <fieldset className="bp-fields" disabled={busy || review}><legend>Proposal Details</legend>{field('title', 'Proposal title *')}
        <YearPicker label="Fiscal year *" disabled={!editable || busy || review} value={proposal.fiscalYear || ''} onChange={value => update('fiscalYear', value)} />
        <label>Proposal type *<select disabled={!editable} value={proposal.proposalType} onChange={e => update('proposalType', e.target.value)}>{['annual', 'supplemental'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
        <label>Program / sector *<select disabled={!editable} value={proposal.sector} onChange={e => update('sector', e.target.value)}>{['infrastructure', 'health', 'education', 'sanitation', 'other'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>{field('justification', 'Purpose / justification *', true)}
      </fieldset>
      <h3>Project / Expenditure Items</h3>{proposal.items.map((item, index) => <fieldset className="bp-fields bp-item-card" key={item.itemId || index} disabled={busy || review}><legend>Project item {index + 1}</legend>{Object.entries({ name: 'Item / activity name *', description: 'Description / spending purpose *', proposedSupplier: 'Proposed supplier / payee (optional)', supplierAddress: 'Supplier location / address', expectedTimeline: 'Expected timeline', additionalDetails: 'Additional details' }).map(([key, label]) => <label className={['name', 'description', 'additionalDetails'].includes(key) ? 'bp-wide' : undefined} key={key}>{label}<textarea maxLength={key === 'name' ? 200 : 4000} value={item[key]} disabled={!editable} onChange={e => update('items', proposal.items.map((v, i) => i === index ? { ...v, [key]: e.target.value } : v))} /></label>)}
        <label>Estimated amount (PHP) *<input type="number" min="0" step="0.01" disabled={!editable} value={item.estimatedAmountCentavos / 100} onChange={e => update('items', proposal.items.map((v, i) => i === index ? { ...v, estimatedAmountCentavos: Math.round(Number(e.target.value) * 100) } : v))} /></label>
        {editable && <button className="bp-danger bp-item-remove" onClick={() => { if (window.confirm('Remove this project item?')) update('items', proposal.items.filter((_, i) => i !== index)); }}>Remove item</button>}
      </fieldset>)}
      {editable && !review && <button disabled={busy || proposal.items.length >= 100} onClick={() => update('items', [...proposal.items, blankItem()])}><Plus size={17} aria-hidden="true" /> Add Project Item</button>}
      </>}
      <div className="bp-total"><span>Total Proposed Amount</span><strong>{money(total)}</strong></div>
      <section className="bp-card bp-documents"><h3 id="budget-proposal-uploads">{editable ? 'Upload Supporting Documents' : 'Captain’s Supporting Documents'}</h3><p>{admin ? 'Supporting files submitted by the Captain for your review.' : 'Optional. PDF, DOCX, XLSX, JPG or PNG; up to five files, 5 MB each, 10 MB combined.'}</p>{!editable && !proposal.documents.length && <p className="bp-no-documents">No supporting documents attached.</p>}
      {proposal.documents.map(doc => <div className="bp-actions bp-document-row" key={doc._id}><span>{doc.originalName} · {doc.mimeType} · {Math.ceil(doc.bytes / 1024)} KB</span><button disabled={busy} onClick={() => run(async () => { const r = await proposals.download(proposal._id, doc._id); const url = URL.createObjectURL(r.data); const link = document.createElement('a'); link.href = url; link.download = doc.originalName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })}><Download size={16} aria-hidden="true" /> Download</button>{editable && !review && <button disabled={busy} onClick={() => { if (window.confirm('Remove this document?')) run(async () => setProposal((await proposals.remove(proposal._id, doc._id, proposal.revision)).data)); }}>Remove</button>}</div>)}
      {editable && !review && <><label className="bp-file-picker"><Upload size={25} aria-hidden="true" /><strong>Choose files to upload</strong><span>Attach estimates, quotations and project references</span><input disabled={busy} type="file" multiple accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={e => { setFiles(previous => [...previous, ...e.target.files]); e.target.value = ''; }} /></label>{files.map((file, i) => <p className="bp-document-row" key={i}>{file.name} · {file.type} · {Math.ceil(file.size / 1024)} KB <button disabled={busy} onClick={() => setFiles(files.filter((_, n) => n !== i))}>Remove</button></p>)}</>}
      </section>
      {editable && <div className="bp-actions bp-form-actions">{review ? <><p>Confirm: {proposal.title}, FY {proposal.fiscalYear}, {proposal.items.length} items, {money(total)}, {proposal.documents.length} attached files. Submission locks this proposal for review.</p><button className="bp-primary" disabled={busy} onClick={() => run(async () => { const p = (await proposals.action(proposal._id, 'submit', { revision: proposal.revision })).data; setProposal(p); setReview(false); setNotice(`${p.proposalNumber}: Pending Review`); navigate(`${base}/${p._id}`, { replace: true }); })}>Submit Proposal</button><button disabled={busy} onClick={() => setReview(false)}>Continue editing</button></> : <><button disabled={busy} onClick={() => run(async () => { const p = await save(); navigate(`${base}/${p._id}`, { replace: true }); setNotice('Draft saved.'); })}>Save as Draft</button><button className="bp-primary" disabled={busy} onClick={() => run(async () => { await save(); setReview(true); })}>Review &amp; Submit</button></>}</div>}
      {admin && proposal.status === 'SUBMITTED' && <div className="bp-card bp-review"><div className="bp-section-title"><ClipboardCheck size={20} aria-hidden="true" /><h3>Administrative Review</h3></div><p>Record your decision after reviewing the proposed items and supporting documents.</p><label>Review remarks (required to reject)<textarea maxLength="4000" value={remarks} onChange={e => setRemarks(e.target.value)} /></label>{['approve', 'reject'].map(action => <button className={action === 'approve' ? 'bp-primary' : 'bp-danger'} key={action} disabled={busy || (action === 'reject' && !remarks.trim())} onClick={() => { if (window.confirm(`${action === 'approve' ? 'Approve this administrative review' : 'Reject this proposal'}?`)) run(async () => setProposal((await proposals.action(proposal._id, action, { revision: proposal.revision, remarks })).data)); }}>{action === 'approve' ? 'Approve Administrative Review' : 'Reject'}</button>)}</div>}
      <section className="bp-card bp-history"><h3>Review History</h3><ol>{proposal.history?.map(e => <li key={e._id}>{new Date(e.at).toLocaleString()} · {e.action.replaceAll('_', ' ')} · {statuses[e.to]} · revision {e.revision}{e.remarks && ` · ${e.remarks}`}{e.snapshotHash && <small> · Snapshot SHA-256: {e.snapshotHash}</small>}</li>)}</ol></section>
    </>}
  </section>;
}
