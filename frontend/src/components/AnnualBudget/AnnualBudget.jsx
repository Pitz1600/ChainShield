import { useEffect, useState } from 'react';
import YearPicker from '../Common/YearPicker';
import api from '../../services/api';
import '../BudgetProposals/BudgetProposalForm.css';
const money = cents => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
export function BudgetFigures({ fiscalYear, refresh = 0 }) {
  const [data, setData] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    let active = true; setData(null); setError('');
    if (!fiscalYear) return;
    api.get(`/annual-budgets/${fiscalYear}`).then(r => { if (active) setData(r.data); }).catch(e => { if (active) setError(e.response?.data?.error || e.message); });
    return () => { active = false; };
  }, [fiscalYear, refresh]);
  return <section className="bp-card" aria-label="Annual proposal budget">
    <h3>Annual Proposal Budget · {fiscalYear || 'Select fiscal year'}</h3>
    {error ? <p role="alert">{error}</p> : data ? <Figures data={data} /> : fiscalYear ? <p>Loading annual budget…</p> : null}
  </section>;
}
function Figures({ data }) {
  return <>
    <dl className="bp-metadata">
      <div><dt>Total proposal budget</dt><dd>{data.pool ? money(data.pool.totalCentavos) : 'Not recorded'}</dd></div>
      <div><dt>Reserved for approved proposals</dt><dd>{money(data.reservedCentavos)}</dd></div>
      <div><dt>Available for proposals</dt><dd>{data.pool ? money(data.availableCentavos) : 'Not recorded'}</dd></div>
    </dl>
    {!data.pool ? <p>You may submit a proposal before a pool is recorded. Approval requires a recorded and reconciled pool for this fiscal year.</p> : !data.pool.reconciled && <p>Approval is blocked until this fiscal year is reconciled.</p>}
    {data.discrepancies.length > 0 && <div role="alert"><strong>Reconciliation discrepancies — approval blocked</strong><ul>{data.discrepancies.map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
  </>;
}
export default function AnnualBudget({ user }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(''), [remarks, setRemarks] = useState(''), [reason, setReason] = useState('');
  const admin = user?.role === 'administrator';
  function receive(value) {
    setData(value); setAmount(value.pool ? String(value.pool.totalCentavos / 100) : '');
    setRemarks(value.pool?.remarks || ''); setReason('');
  }
  useEffect(() => {
    let active = true; setData(null); setError('');
    api.get(`/annual-budgets/${year}`).then(r => { if (active) receive(r.data); }).catch(e => { if (active) setError(e.response?.data?.error || e.message); });
    return () => { active = false; };
  }, [year]);
  async function run(action) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); receive((await api.get(`/annual-budgets/${year}`)).data); }
    catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  }
  function save(event) {
    event.preventDefault();
    run(async () => {
      if (!/^\d+(\.\d{1,2})?$/.test(amount)) throw new Error('Enter a nonnegative peso amount with at most two decimal places');
      const totalCentavos = Math.round(Number(amount) * 100);
      if (!Number.isSafeInteger(totalCentavos)) throw new Error('Budget amount is too large');
      const body = { totalCentavos, remarks, reason, revision: data.pool?.revision };
      await api[data.pool ? 'patch' : 'post'](`/annual-budgets/${year}`, body);
    });
  }
  return <section className="budget-proposals">
    <header className="bp-page-header"><div><h1>Annual Budget</h1><p>The supported portion of the barangay budget available for proposals monitored by ChainShield.</p></div></header>
    <p>This system record does not enact a budget, certify cash availability or represent a bank deposit. Authorized officials must check each proposal’s permitted purpose and supporting authority.</p>
    <YearPicker value={year} disabled={busy} onChange={setYear} />
    {error && <p className="bp-error" role="alert">{error}</p>}
    {data && <>
      <section className="bp-card"><Figures data={data} />{data.pool && <>{data.pool.reference && <p>Supporting reference: {data.pool.reference}</p>}<p>{data.pool.remarks}</p></>}</section>
      {admin && <form onSubmit={save}><fieldset className="bp-fields" disabled={busy}><legend>{data.pool ? 'Adjust annual pool' : 'Record annual pool'}</legend>
        <label>Budget available for proposals (PHP) *<input required inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <label>Remarks<textarea maxLength="4000" value={remarks} onChange={e => setRemarks(e.target.value)} /></label>
        {data.pool && <label>Reason for adjustment *<textarea required maxLength="4000" value={reason} onChange={e => setReason(e.target.value)} /></label>}
      </fieldset><div className="bp-actions">
        <button type="submit" className="bp-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div></form>}
      {admin && data.pool && <section className="bp-card"><h3>Reconcile existing approvals</h3><p>Includes archived approvals. A restorable database snapshot is retained before updating reservations. Incomplete records or totals above the pool keep approvals blocked.</p><button disabled={busy} onClick={() => run(() => api.post(`/annual-budgets/${year}/reconcile`, { revision: data.pool.revision }))}>Back up and reconcile this year</button></section>}
      {data.pool && <section className="bp-card"><h3>Adjustment and reconciliation history</h3><ol>{data.pool.history.map(h => <li key={h._id}>
        {new Date(h.at).toLocaleString()} · {h.actor?.firstName} {h.actor?.lastName} · {h.action}
        {h.newCentavos != null && <span> · {h.previousCentavos != null ? `${money(h.previousCentavos)} → ` : ''}{money(h.newCentavos)}</span>}
        {h.reason && <p>{h.reason}</p>}{h.reference && <p>Reference: {h.reference}</p>}
      </li>)}</ol></section>}
    </>}
  </section>;
}
