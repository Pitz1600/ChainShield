import React, { useState, useEffect } from 'react';
import {
  CheckCircle, AlertTriangle, Clock, FileText,
  ChevronLeft, ChevronRight, TrendingUp, ShieldCheck,
  MessageSquare, RefreshCw, Landmark, Coins, Wallet, Building2
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
  if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000)    return `₱${(num / 1_000).toFixed(1)}K`;
  return `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTimeAgo = (timestamp) => {
  const diffMs   = Date.now() - new Date(timestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

const statusConfig = {
  Verified:   { label: 'Verified',      bg: '#dcfce7', color: '#166534', dot: '#10b981' },
  Pending:    { label: 'Pending',        bg: '#fef9c3', color: '#854d0e', dot: '#f59e0b' },
  Flagged:    { label: 'Under Review',   bg: '#ffedd5', color: '#9a3412', dot: '#f97316' },
  Suspicious: { label: 'Under Review',   bg: '#ffedd5', color: '#9a3412', dot: '#f97316' },
  Rejected:   { label: 'Not Approved',   bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
};

const getStatus = (vs) => statusConfig[vs] || statusConfig.Pending;

const friendlyType = (type) => {
  const map = {
    'Social Welfare': 'Social Welfare', 'Procurement': 'Procurement',
    'Grant': 'Grant / Subsidy', 'Tax': 'Tax / Revenue', 'Other': 'General Expense',
  };
  return map[type] || type || 'General Expense';
};

/* ═══════════════════════════════════════════════════════════ */
function ResidentDashboard({ user, onNavigate }) {
  const [stats, setStats]             = useState({ total: 0, verified: 0, pending: 0, underReview: 0, totalAmount: 0 });
  const [budgetSummary, setBudgetSummary] = useState({
    estimatedBarangayBudget: 15000000,
    totalTransactionsBudget: 0,
    remainingBudget: 15000000,
    utilizationRate: 0,
    verifiedAmount: 0,
    pendingAmount: 0,
    flaggedAmount: 0
  });
  const [recentTxns, setRecentTxns]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PER_PAGE = 5;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, budgetRes] = await Promise.all([
        api.get('/transactions/my-transactions', {
          params: { limit: 50, sortBy: 'timestamp', sortOrder: 'desc', includeStaged: true }
        }),
        api.get('/transactions/budget-summary').catch(() => ({ data: null }))
      ]);

      const txns = res.data.transactions || [];

      const verified    = txns.filter(t => t.verificationStatus === 'Verified').length;
      const underReview = txns.filter(t => ['Flagged','Suspicious'].includes(t.verificationStatus)).length;
      const pending     = txns.filter(t => !t.verificationStatus || t.verificationStatus === 'Pending').length;
      const totalAmount = txns.reduce((sum, t) => sum + Number(t.amount || 0), 0);

      setStats({ total: txns.length, verified, pending, underReview, totalAmount });
      setRecentTxns(txns.slice(0, 20));

      if (budgetRes.data && budgetRes.data.success) {
        setBudgetSummary(budgetRes.data);
      } else {
        const est = 15000000;
        setBudgetSummary({
          estimatedBarangayBudget: est,
          totalTransactionsBudget: totalAmount,
          remainingBudget: Math.max(0, est - totalAmount),
          utilizationRate: est > 0 ? Math.round((totalAmount / est) * 1000) / 10 : 0
        });
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('ResidentDashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages  = Math.ceil(recentTxns.length / PER_PAGE);
  const pagedTxns   = recentTxns.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const verifiedPct = stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0;

  if (loading) {
    return (
      <div className="dashboard-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">

      {/* ── HERO BANNER ── */}
      <div className="dashboard-hero">
        <div className="hero-content">
          <span className="hero-tag">BARANGAY PANTAL — PUBLIC TRANSPARENCY PORTAL</span>
          <h2 className="hero-title">
            Welcome, {user?.firstName || user?.username || 'Resident'}!
          </h2>
          <p className="hero-subtitle">
            View how your barangay budget is being spent. All transactions are recorded and verified for transparency.
          </p>
        </div>

        <div className="hero-stats-grid">
          <div className="hero-stat-card total">
            <div className="stat-icon" style={{ color: '#93c5fd' }}><Landmark size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value">{formatPHP(budgetSummary.estimatedBarangayBudget || 15000000)}</div>
              <div className="hero-stat-label">Estimated Budget</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <div className="stat-icon" style={{ color: '#6ee7b7' }}><Coins size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value">{formatPHP(budgetSummary.totalTransactionsBudget || stats.totalAmount)}</div>
              <div className="hero-stat-label">Total Disbursed</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(16,185,129,0.15)' }}>
            <div className="stat-icon" style={{ color: '#10b981' }}><CheckCircle size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value" style={{ color: '#10b981' }}>{formatCompact(stats.verified)}</div>
              <div className="hero-stat-label">Verified Records</div>
            </div>
          </div>
          <div className="hero-stat-card" style={{ background: 'rgba(249,115,22,0.15)' }}>
            <div className="stat-icon" style={{ color: '#f97316' }}><AlertTriangle size={24} /></div>
            <div className="stat-content">
              <div className="hero-stat-value" style={{ color: '#f97316' }}>{formatCompact(stats.underReview)}</div>
              <div className="hero-stat-label">Under Review</div>
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
              <p className="card-subtitle">Latest barangay spending records
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
              <p>No transactions found</p>
            </div>
          ) : (
            pagedTxns.map((tx, i) => {
              const st  = getStatus(tx.verificationStatus);
              const amt = Number(tx.amount || 0);
              return (
                <div key={tx._id} className="alert-item" style={{ borderBottom: i < pagedTxns.length - 1 ? '0.5px solid var(--color-border-tertiary)' : 'none' }}>
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
          <div className="card-header" style={{ marginBottom: '0.75rem' }}>
            <div>
              <h3 className="card-title">Budget Summary</h3>
              <p className="card-subtitle">Public fund allocation & spending</p>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8' }}>
              Transparency
            </span>
          </div>

          <div className="budget-dual-summary">
            <div className="budget-stat-box primary-box">
              <div className="budget-stat-box-label">Estimated Budget</div>
              <div className="budget-stat-box-value" style={{ color: '#1d4ed8' }}>
                {formatPHP(budgetSummary.estimatedBarangayBudget || 15000000)}
              </div>
              <div className="budget-stat-box-sub">Barangay Allocation</div>
            </div>
            <div className="budget-stat-box">
              <div className="budget-stat-box-label">Total Transactions</div>
              <div className="budget-stat-box-value" style={{ color: '#0f172a' }}>
                {formatPHP(budgetSummary.totalTransactionsBudget || stats.totalAmount)}
              </div>
              <div className="budget-stat-box-sub">Total Disbursed</div>
            </div>
          </div>

          {/* Budget Utilization bar */}
          <div style={{ margin: '0.5rem 0 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Budget Utilization</span>
              <span style={{ fontWeight: 700, color: '#2563eb' }}>
                {budgetSummary.utilizationRate || (stats.totalAmount > 0 ? ((stats.totalAmount / 15000000) * 100).toFixed(1) : 0)}%
                <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 4 }}>
                  ({formatPHP(budgetSummary.remainingBudget || Math.max(0, 15000000 - stats.totalAmount))} left)
                </span>
              </span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, budgetSummary.utilizationRate || (stats.totalAmount > 0 ? (stats.totalAmount / 15000000) * 100 : 0))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                borderRadius: 9999,
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>

          {/* verification progress bar */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Verification progress</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>{verifiedPct}%</span>
            </div>
            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
              <div style={{ width: `${verifiedPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: 9999, transition: 'width 0.5s ease' }} />
            </div>
          </div>

          <div className="risk-bars">
            {[
              { label: 'Verified',      count: stats.verified,    total: stats.total, color: '#10b981', bg: '#dcfce7' },
              { label: 'Pending',       count: stats.pending,     total: stats.total, color: '#f59e0b', bg: '#fef9c3' },
              { label: 'Under Review',  count: stats.underReview, total: stats.total, color: '#f97316', bg: '#ffedd5' },
            ].map(({ label, count, total, color, bg }) => (
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

        {/* ── BOTTOM ROW ── */}
        <div className="dashboard-bottom-grid">

          {/* Transparency meter */}
          <div className="dashboard-card">
            <h3 className="card-title">Transparency Score</h3>
            <p className="card-subtitle">How well spending is documented</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 0' }}>
              <div style={{ position: 'relative', width: 100, height: 100 }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-background-secondary)" strokeWidth="10" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="10"
                    strokeDasharray={`${verifiedPct * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10b981' }}>{verifiedPct}%</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              <span><span style={{ color: '#10b981', fontWeight: 600 }}>{stats.verified}</span> verified</span>
              <span><span style={{ color: '#f59e0b', fontWeight: 600 }}>{stats.pending}</span> pending</span>
            </div>
          </div>

          {/* Quick actions */}
          <div className="dashboard-card">
            <h3 className="card-title">Quick Actions</h3>
            <p className="card-subtitle">Things you can do</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: '0.75rem' }}>
              {[
                { label: 'View all transactions',   icon: <FileText size={15} />,    view: 'transactions', color: '#1e40af', bg: '#eff6ff' },
                { label: 'Submit a feedback',       icon: <MessageSquare size={15} />, view: 'feedbacks',   color: '#166534', bg: '#f0fdf4' },
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

          {/* How it works */}
          <div className="dashboard-card">
            <h3 className="card-title">How This Works</h3>
            <p className="card-subtitle">Understanding the system</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: '0.75rem' }}>
              {[
                { dot: '#10b981', title: 'Verified',     desc: 'Officially reviewed and approved by the barangay' },
                { dot: '#f59e0b', title: 'Pending',       desc: 'Submitted and awaiting official review' },
                { dot: '#f97316', title: 'Under Review',  desc: 'Flagged by AI for additional inspection' },
                { dot: '#3b82f6', title: 'Blockchain',    desc: 'High-risk records are stored permanently on-chain' },
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
    </div>
  );
}

export default ResidentDashboard;
