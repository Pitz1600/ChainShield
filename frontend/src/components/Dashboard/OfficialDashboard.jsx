import React, { useState, useEffect } from 'react';
import {
  CheckCircle, AlertTriangle, Clock, FileText,
  ChevronLeft, ChevronRight, Upload, Shield,
  BarChart2, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';

const formatCompact = (value) => {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1
  }).format(num);
};

const formatPHP = (value) => {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000)     return `₱${(num / 1_000).toFixed(1)}K`;
  return `₱${num.toLocaleString('en-PH')}`;
};

const getTimeAgo = (ts) => {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const statusConfig = {
  Verified:   { label: 'Approved',     bg: '#dcfce7', color: '#166534', dot: '#10b981' },
  Pending:    { label: 'Pending',       bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b' },
  Flagged:    { label: 'Under Review',  bg: '#ffedd5', color: '#9a3412', dot: '#f97316' },
  Suspicious: { label: 'Under Review',  bg: '#ffedd5', color: '#9a3412', dot: '#f97316' },
  Rejected:   { label: 'Rejected',      bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};
const getStatus = (vs) => statusConfig[vs] || statusConfig.Pending;

const friendlyType = (type) => {
  const map = {
    'Social Welfare': 'Social Welfare', 'Procurement': 'Procurement',
    'Grant': 'Grant / Subsidy', 'Tax': 'Tax / Revenue', 'Other': 'General Expense',
  };
  return map[type] || type || 'General Expense';
};

function OfficialDashboard({ user, onNavigate }) {
  const [stats, setStats]             = useState({ total: 0, approved: 0, pending: 0, flagged: 0, totalAmount: 0 });
  const [programs, setPrograms]       = useState([]);
  const [recentTxns, setRecentTxns]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 5;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/transactions/my-transactions', {
        params: { limit: 100, sortBy: 'timestamp', sortOrder: 'desc', includeStaged: true }
      });
      const txns = res.data.transactions || [];

      const approved    = txns.filter(t => t.verificationStatus === 'Verified').length;
      const flagged     = txns.filter(t => ['Flagged', 'Suspicious'].includes(t.verificationStatus)).length;
      const pending     = txns.filter(t => !t.verificationStatus || t.verificationStatus === 'Pending').length;
      const totalAmount = txns.reduce((s, t) => s + Number(t.amount || 0), 0);

      setStats({ total: txns.length, approved, pending, flagged, totalAmount });
      setRecentTxns(txns.slice(0, 20));

      const byProgram = {};
      txns.forEach(t => {
        const k = t.programName || t.agency || 'General';
        if (!byProgram[k]) byProgram[k] = { amount: 0, count: 0, flagged: 0 };
        byProgram[k].amount += Number(t.amount || 0);
        byProgram[k].count  += 1;
        if (['Flagged', 'Suspicious'].includes(t.verificationStatus)) byProgram[k].flagged += 1;
      });
      const sorted = Object.entries(byProgram).sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
      const maxAmt = sorted[0]?.[1]?.amount || 1;
      setPrograms(sorted.map(([name, d]) => ({ name, ...d, pct: Math.round((d.amount / maxAmt) * 100) })));

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('OfficialDashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages  = Math.ceil(recentTxns.length / PER_PAGE);
  const pagedTxns   = recentTxns.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const approvalPct = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading your dashboard...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      {/* ── HERO — same class as ResidentDashboard ── */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <span className="hero-tag">BARANGAY OFFICIAL — TRANSACTION MANAGEMENT</span>
          <h2 className="hero-title">
            Welcome back, {user?.firstName || user?.username || 'Official'}!
          </h2>
          <p className="hero-subtitle">
            Manage your barangay's budget transactions, review AI-flagged items, and maintain transparency records.
          </p>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-stat-card total">
            <div className="stat-icon"><FileText size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value">{formatCompact(stats.total)}</div>
              <div className="hero-stat-label">Transactions</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <div className="stat-icon" style={{ color: '#10b981' }}><CheckCircle size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value" style={{ color: '#10b981' }}>{formatCompact(stats.approved)}</div>
              <div className="hero-stat-label">Approved</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(245,158,11,0.15)' }}>
            <div className="stat-icon" style={{ color: '#f59e0b' }}><Clock size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value" style={{ color: '#f59e0b' }}>{formatCompact(stats.pending)}</div>
              <div className="hero-stat-label">Pending</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(249,115,22,0.15)' }}>
            <div className="stat-icon" style={{ color: '#f97316' }}><AlertTriangle size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value" style={{ color: '#f97316' }}>{formatCompact(stats.flagged)}</div>
              <div className="hero-stat-label">Flagged</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-cards">

        {/* ── RECENT TRANSACTIONS ── */}
        <div className="dashboard-card primary-panel recent-alerts-card" style={{ gridColumn: '1 / span 2' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Transactions</h3>
              <p className="card-subtitle">
                Latest submitted records
                {lastRefreshed && ` · Updated ${getTimeAgo(lastRefreshed)}`}
              </p>
            </div>
            <button className="rt-refresh-btn" onClick={fetchData} title="Refresh">
              <RefreshCw size={15} />
            </button>
          </div>

          {pagedTxns.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <FileText size={32} color="#cbd5e1" style={{ marginBottom: 8 }} />
              <p style={{ marginBottom: 12 }}>No transactions yet.</p>
              <button onClick={() => onNavigate('transactions')}
                style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                Import CSV
              </button>
            </div>
          ) : (
            pagedTxns.map((tx, i) => {
              const st  = getStatus(tx.verificationStatus);
              const amt = Number(tx.amount || 0);
              return (
                <div key={tx._id || i} className="alert-item"
                  style={{ borderBottom: i < pagedTxns.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
                  <div className="alert-info">
                    <span className="severity-dot" style={{ background: st.dot }} />
                    <div className="alert-text-content">
                      <div className="alert-type" style={{ fontWeight: 500 }}>
                        {tx.description || tx.transactionType || '—'}
                      </div>
                      <div className="alert-time">
                        {friendlyType(tx.type || tx.transactionType)}
                        {tx.agency && ` · ${tx.agency}`}
                        {` · ${new Date(tx.date || tx.timestamp || tx.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </div>
                    </div>
                  </div>
                  <div className="alert-meta" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      ₱ {amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                    <span style={{ padding: '2px 10px', borderRadius: 9999, fontSize: '0.72rem', fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {totalPages > 1 && (
            <div className="dashboard-pagination">
              <button className="pagination-btn-small" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft size={16} />
              </button>
              <span className="pagination-text-small">{currentPage} / {totalPages}</span>
              <button className="pagination-btn-small" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* ── BUDGET SUMMARY ── */}
        <div className="dashboard-card primary-panel">
          <h3 className="card-title">Budget Summary</h3>
          <p className="card-subtitle">Total submitted spending</p>

          <div style={{ textAlign: 'center', padding: '1.5rem 0 1rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>
              Total Budget
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {formatPHP(stats.totalAmount)}
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Approval progress</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>{approvalPct}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--color-background-secondary)', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ width: `${approvalPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 9999, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          <div className="risk-bars">
            {[
              { label: 'Approved', count: stats.approved, total: stats.total, color: '#10b981' },
              { label: 'Pending',  count: stats.pending,  total: stats.total, color: '#f59e0b' },
              { label: 'Flagged',  count: stats.flagged,  total: stats.total, color: '#f97316' },
            ].map(({ label, count, total, color }) => (
              <div key={label} className="risk-bar-item">
                <div className="risk-bar-label">
                  <span className="risk-dot" style={{ background: color }} />
                  <span>{label}</span>
                </div>
                <div className="progress-bg">
                  <div style={{ width: `${total > 0 ? (count / total * 100) : 0}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.5s' }} className="progress-fill" />
                </div>
                <span className="risk-count">{formatCompact(count)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM GRID ── */}
        <div className="dashboard-bottom-grid">

          {/* Budget by Program */}
          <div className="dashboard-card">
            <h3 className="card-title">Budget by Program</h3>
            <p className="card-subtitle">Top spending categories</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: '0.75rem' }}>
              {programs.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem' }}>No data yet</p>
              ) : programs.map(({ name, amount, count, flagged: fl, pct }) => (
                <div key={name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-primary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={name}>{name}</span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{formatPHP(amount)}</span>
                  </div>
                  <div style={{ height: 5, background: 'var(--color-background-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: fl > 0 ? '#f97316' : '#8b5cf6', borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>{count} transaction{count !== 1 ? 's' : ''}</span>
                    {fl > 0 && <span style={{ fontSize: '0.68rem', color: '#f97316', fontWeight: 600 }}>⚠ {fl} flagged</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-card">
            <h3 className="card-title">Quick Actions</h3>
            <p className="card-subtitle">Navigate to key sections</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: '0.75rem' }}>
              {[
                { label: 'View all transactions',     icon: <FileText size={15} />, view: 'transactions',      color: '#1e40af', bg: '#eff6ff' },
                { label: 'Open analytics',            icon: <BarChart2 size={15} />,view: 'analytics',         color: '#6b21a8', bg: '#faf5ff' },
              ].map(({ label, icon, view, color, bg }) => (
                <button key={label}
                  onClick={() => view && onNavigate && onNavigate(view)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1px solid ${color}22`, background: bg, color, fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Guide */}
          <div className="dashboard-card">
            <h3 className="card-title">Status Guide</h3>
            <p className="card-subtitle">What each status means</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '0.75rem' }}>
              {[
                { dot: '#10b981', title: 'Approved',    desc: 'Transaction reviewed and officially confirmed' },
                { dot: '#f59e0b', title: 'Pending',      desc: 'Imported and awaiting admin approval' },
                { dot: '#f97316', title: 'Under Review', desc: 'AI flagged for suspicious activity' },
                { dot: '#3b82f6', title: 'Blockchain',   desc: 'High-risk records stored permanently on-chain' },
              ].map(({ dot, title, desc }) => (
                <div key={title} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0, marginTop: 5 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default OfficialDashboard;