import { useEffect, useRef, useState } from 'react';
import YearPicker from '../Common/YearPicker';
import { reportsAPI } from '../../services/api';
import FinancialReportPreview, { titles } from './FinancialReportPreview';
import '../BudgetProposals/BudgetProposalForm.css';
import './Reports.css';
export default function FinancialReports({ user, budget, onClose }) {
  const [filters, setFilters] = useState({ type: 'summary', fiscalYear: budget?.fiscalYear || '', proposalId: budget?._id || '', allocationId: '', from: '', to: '', status: '', dateBasis: 'expenditure', includeHistory: false });
  const [access, setAccess] = useState(null), [options, setOptions] = useState({ fiscalYears: [], proposals: [] });
  const [report, setReport] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [printing, setPrinting] = useState(false);
  const request = useRef(null), revision = useRef(0);
  const stale = report && Object.keys(report.filters).some(k => report.filters[k] !== (k === 'fiscalYear' ? Number(filters[k]) : filters[k]));
  useEffect(() => {
    const controller = new AbortController();
    document.body.classList.add('financial-report-page');
    setReport(null); setAccess(null);
    reportsAPI.access(controller.signal).then(r => setAccess(r.data)).catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.error || e.message); });
    return () => { controller.abort(); request.current?.abort(); document.body.classList.remove('financial-print-ready', 'financial-report-page'); };
  }, [user?._id, user?.id]);
  useEffect(() => {
    if (!access?.reportTypes.length) return;
    const controller = new AbortController();
    (async () => {
      let page = 1, result, proposals = [];
      do { result = (await reportsAPI.options({ fiscalYear: filters.fiscalYear || undefined, page }, controller.signal)).data; proposals.push(...result.proposals); page++; } while (page <= result.pages);
      if (!controller.signal.aborted) setOptions({ fiscalYears: result.fiscalYears, proposals });
    })().catch(e => { if (!controller.signal.aborted) setError(e.response?.data?.error || e.message); });
    return () => controller.abort();
  }, [access, filters.fiscalYear]);
  useEffect(() => {
    const done = () => { setPrinting(false); document.body.classList.remove('financial-print-ready'); };
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);
  const change = values => { revision.current++; request.current?.abort(); setBusy(false); document.body.classList.remove('financial-print-ready'); setFilters(f => ({ ...f, ...values })); };
  async function generate(event) {
    event.preventDefault(); request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError(''); setReport(null);
    try { const r = await reportsAPI.preview(filters, controller.signal); if (!controller.signal.aborted) setReport(r.data); }
    catch (e) { if (!controller.signal.aborted) setError(e.response?.data?.error || e.message); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  async function print() {
    const version = revision.current;
    setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const r = await reportsAPI.access(controller.signal);
      if (!r.data.reportTypes.includes(report.filters.type)) { setReport(null); setAccess(r.data); throw new Error('Reporting access is no longer available.'); }
      if (controller.signal.aborted || version !== revision.current) return;
      await document.fonts.ready;
      if (controller.signal.aborted || version !== revision.current) return;
      document.body.classList.add('financial-print-ready'); setPrinting(true);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      window.print();
    } catch (e) { if (!controller.signal.aborted) { setReport(null); setError(e.response?.data?.error || e.message); } }
    finally { setBusy(false); }
  }
  const proposal = options.proposals.find(p => p.id === filters.proposalId);
  return <section className="financial-reports"><div className="report-controls budget-proposals"><button className="bp-back" type="button" disabled={printing} onClick={onClose}>Back to budget</button><header className="bp-page-header"><div><h1>Print budget</h1><p>{budget?.proposalNumber} · {budget?.title}</p></div></header><p>Generate a preview, inspect the figures, then print or save as PDF. Maximum 5,000 matching expenditures and 8 MB per report.</p>
    {error && <p className="bp-error" role="alert">{error}</p>}
    {!access ? <p>Loading report access…</p> : !access.reportTypes.length ? <p>{access.enabled ? 'Reporting access denied.' : 'Budget expenditure reports are unavailable.'}</p> : <form onSubmit={generate}><fieldset className="report-filter-grid" disabled={printing}><legend>Report filters</legend>
      <label>Template<select value={filters.type} onChange={e => change({ type: e.target.value, from: '', to: '', status: '', dateBasis: 'expenditure', includeHistory: false })}>{access.reportTypes.map(t => <option key={t} value={t}>{titles[t]}</option>)}</select></label>
      <YearPicker disabled={Boolean(budget) || printing} value={filters.fiscalYear} years={options.fiscalYears} onChange={value => change({ fiscalYear: value, proposalId: '', allocationId: '' })} />
      <label>Approved proposal<select disabled={Boolean(budget)} value={filters.proposalId} onChange={e => change({ proposalId: e.target.value, allocationId: '' })}><option value="">All approved proposals</option>{options.proposals.filter(p => p.fiscalYear === Number(filters.fiscalYear)).map(p => <option key={p.id} value={p.id}>{p.proposalNumber} · {p.title}</option>)}</select></label>
      <label>Allocation<select disabled={!proposal} value={filters.allocationId} onChange={e => change({ allocationId: e.target.value })}><option value="">All allocations</option>{proposal?.allocations.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      <fieldset className="report-period" disabled={filters.type === 'summary'}><legend>Period and current review status (registers only)</legend>{['from', 'to'].map(k => <label key={k}>{k === 'from' ? 'From (Philippine time)' : 'Through (inclusive)'}<input type="date" value={filters[k]} onChange={e => change({ [k]: e.target.value })} /></label>)}<label>Human review status<select value={filters.status} onChange={e => change({ status: e.target.value })}><option value="">All statuses</option>{['submitted', 'correction_required', 'verified', 'rejected'].map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></label></fieldset>
      {filters.type === 'audit' && <><label>Date basis<select value={filters.dateBasis} onChange={e => change({ dateBasis: e.target.value })}><option value="expenditure">Expenditure date</option><option value="review">Review date</option></select></label><label className="bp-checkbox"><input type="checkbox" checked={filters.includeHistory} onChange={e => change({ includeHistory: e.target.checked })} />Include detailed history and checksums</label></>}
      <button className="bp-primary report-generate" disabled={busy || !filters.fiscalYear}>{busy ? 'Working…' : 'Generate preview'}</button></fieldset></form>}
    {stale && <p role="status">Filters changed. Generate a new preview before printing.</p>}
    {report && <button className="bp-primary" disabled={busy || printing || stale || !report.printable} onClick={print}>Print / Save as PDF</button>}
  </div>{report && <><style>{`@page { size: A4 ${report.filters.type === 'summary' ? 'portrait' : 'landscape'}; margin: 12mm; }`}</style><FinancialReportPreview report={report} /></>}</section>;
}
