import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { proposalMoney } from './useProposalBudget';
import YearPicker from '../Common/YearPicker';

export default function ProposalBudgetOverview({ budget }) {
  const { year, setYear, data, loading, error, refresh } = budget;
  const figures = [
    ['Total proposal budget', data?.pool?.totalCentavos, 'highlight-blue'],
    ['Reserved for approved proposals', data?.reservedCentavos, 'highlight-green'],
    ['Available for proposals', data?.availableCentavos, 'highlight-amber']
  ];
  return <section className="budget-overview-card proposal-budget-overview" aria-label="Proposal budget overview">
    <div className="budget-overview-header"><div><h3 className="card-title">Proposal Budget Overview</h3><p className="card-subtitle">Annual proposal budget and approved reservations · FY {year}</p></div>
      <button type="button" className="rt-refresh-btn" onClick={refresh} disabled={loading} aria-label="Refresh proposal budget"><RefreshCw size={15} /></button>
    </div>
    <YearPicker value={year} onChange={setYear} />
    {loading || (!data && !error) ? <p role="status">Loading proposal budget…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="budget-overview-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>{figures.map(([label, cents, color]) => <div className={`budget-metric-card ${color}`} key={label}><div className="budget-metric-body"><div className="budget-metric-label">{label}</div><div className="budget-metric-value">{proposalMoney(cents)}</div></div></div>)}</div>
      {!data.pool ? <p>No annual proposal budget is recorded for {year}. Proposals may be submitted, but approval requires a recorded and reconciled pool.</p> : !data.pool.reconciled && <p>Reconciliation is required before approving proposals for this year.</p>}
      {data.discrepancies?.length > 0 && <div role="alert"><strong>Approval blocked: reconciliation discrepancies</strong><ul>{data.discrepancies.map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
      <p>Draft and submitted proposals do not reserve funds. Expenditures do not deduct from the annual pool again.</p>
      <Link to="/dashboard/annual-budget">View Annual Budget</Link>
    </>}
  </section>;
}
