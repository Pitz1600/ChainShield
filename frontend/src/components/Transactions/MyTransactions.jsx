import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle, CheckCircle, Clock, FileText,
  ChevronLeft, ChevronRight,
  ArrowUpDown, Filter, X, Trash2, Flag, ThumbsUp,
  Link2, Info
} from 'lucide-react';
import api from '../../services/api';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/MyTransactions.css';
import '../../styles/ColorfulIcons.css';

/* ------------------------------------------------------------------ */
/*  Helpers                                                              */
/* ------------------------------------------------------------------ */
const riskClass = (score) => {
  if (score >= 90) return 'risk-critical';
  if (score >= 71) return 'risk-high';
  if (score >= 41) return 'risk-medium';
  return 'risk-low';
};

const RISK_COLOR = (score) => {
  if (score >= 90) return '#ef4444';
  if (score >= 71) return '#f97316';
  if (score >= 41) return '#f59e0b';
  return '#10b981';
};

const RISK_LABEL = (score) => {
  if (score >= 90) return 'CRITICAL';
  if (score >= 71) return 'HIGH';
  if (score >= 41) return 'MEDIUM';
  return 'LOW RISK';
};

const isMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return false;
  return !['n/a', 'na', '-', 'unknown', 'unknown agency', 'unknown program'].includes(normalized);
};

/* ------------------------------------------------------------------ */
/*  SVG Risk Gauge Component                                           */
/* ------------------------------------------------------------------ */
function RiskGauge({ score = 0 }) {
  const safeScore = Math.min(100, Math.max(0, Number(score) || 0));
  const color = RISK_COLOR(safeScore);

  return (
    <div className="risk-bar-wrap">
      <div className="risk-bar-score" style={{ color }}>
        {safeScore}
        <span className="risk-bar-score-max">/100</span>
      </div>
      <div className="risk-bar-level">{RISK_LABEL(safeScore)}</div>
      <div className="risk-bar-track" aria-label={`Risk ${safeScore} of 100`}>
        <div className="risk-bar-segment low" />
        <div className="risk-bar-segment medium" />
        <div className="risk-bar-segment high" />
        <div className="risk-bar-segment critical" />
        <div className="risk-bar-indicator" style={{ left: `calc(${safeScore}% - 6px)`, background: color }} />
      </div>
      <div className="risk-bar-labels">
        <span><span className="legend-dot" style={{ background: '#10b981' }} /> Low (0-40)</span>
        <span><span className="legend-dot" style={{ background: '#f59e0b' }} /> Medium (41-70)</span>
        <span><span className="legend-dot" style={{ background: '#f97316' }} /> High (71-89)</span>
        <span><span className="legend-dot" style={{ background: '#ef4444' }} /> Critical (90+)</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Formula Breakdown                                                    */
/* ------------------------------------------------------------------ */
function FormulaBreakdown({ tx }) {
  if (!tx) return null;
  const riskScore = tx.riskScore ?? 0;
  const mean = 50;
  const stddev = 25;
  const zScore = ((riskScore - mean) / stddev).toFixed(2);
  const threshold = 1.5;
  const isSuspicious = Math.abs(parseFloat(zScore)) > threshold;

  return (
    <div className="formula-card">
      <h4 className="formula-title"><Info size={14} style={{ display: 'inline', marginRight: 6 }} />Anomaly Analysis</h4>
      <div className="formula-body">
        <div className="formula-row">
          <span className="formula-label">Formula</span>
          <span className="formula-val formula-eq">Z = (X - μ) / σ</span>
        </div>
        <div className="formula-row">
          <span className="formula-label">Risk Score (X)</span>
          <span className="formula-val">{riskScore}</span>
        </div>
        <div className="formula-row">
          <span className="formula-label">Mean (mu)</span>
          <span className="formula-val">{mean}</span>
        </div>
        <div className="formula-row">
          <span className="formula-label">Std Dev (sigma)</span>
          <span className="formula-val">{stddev}</span>
        </div>
        <div className="formula-row">
          <span className="formula-label">Z-Score</span>
          <span className="formula-val formula-zscore" style={{ color: isSuspicious ? '#ef4444' : '#10b981' }}>
            {zScore} {isSuspicious ? 'Anomalous' : 'Normal'}
          </span>
        </div>
        <div className="formula-row">
          <span className="formula-label">Threshold</span>
          <span className="formula-val">|Z| &gt; {threshold}</span>
        </div>
        <div className={`formula-verdict ${isSuspicious ? 'verdict-suspicious' : 'verdict-normal'}`}>
          {isSuspicious
            ? `SUSPICIOUS - Z-score ${zScore} exceeds threshold +/-${threshold}`
            : `NORMAL - Z-score ${zScore} is within normal range +/-${threshold}`}
        </div>
        {tx.reasons && tx.reasons.length > 0 && (
          <div className="formula-patterns">
            <div className="formula-patterns-title">Reason Why</div>
            {tx.reasons.map((reason, i) => (
              <div key={i} className="formula-pattern-item">
                <span className="pattern-desc">{reason}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status Badge                                                         */
/* ------------------------------------------------------------------ */
const getStatusBadge = (status) => {
  const map = {
    Verified: { color: '#10b981', bg: '#d1fae5', label: 'Verified' },
    Flagged: { color: '#f97316', bg: '#ffedd5', label: 'Flagged' },
    Pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
    Rejected: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' },
    Suspicious: { color: '#ea580c', bg: '#ffedd5', label: 'Suspicious' },
    Clean: { color: '#0ea5e9', bg: '#e0f2fe', label: 'Clean' }
  };
  const config = map[status] || map.Pending;
  return (
    <span style={{
      padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem',
      fontWeight: '600', backgroundColor: config.bg, color: config.color
    }}>{config.label}</span>
  );
};

/* ================================================================== */
/*  Main Component                                                       */
/* ================================================================== */
function MyTransactions({ user, embedded = false }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & search
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modal
  const [selectedTx, setSelectedTx] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Multi-select
  const [selected, setSelected] = useState(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Modal tab state
  const [modalTab, setModalTab] = useState('details');

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', type: 'success' });
  const TOAST_DURATION = 4500;

  const isAdminOrAuditor = ['administrator', 'auditor', 'barangay_official'].includes(user?.role);

  /* ---- Toast ---- */
  const showToast = (text, type = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage({ text: '', type: 'success' }), TOAST_DURATION);
  };

  /* ---- Debounce search ---- */
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(prev => prev.search !== searchInput ? { ...prev, search: searchInput } : prev);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* ---- Fetch ---- */
  useEffect(() => { fetchMyTransactions(); }, [filters, sortBy, sortOrder, currentPage]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'tx_refresh') fetchMyTransactions(); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const fetchMyTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        limit: 5000,
        sortBy,
        sortOrder,
        ...(isAdminOrAuditor && { includeStaged: true }),
        ...(filters.search && { search: filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
      };
      const res = await api.get('/transactions/my-transactions', { params });
      setTransactions(res.data.transactions || []);
      setSelected(new Set());
    } catch (err) {
      if (err.response?.status === 404) setTransactions([]);
      else { console.error(err); setError('Failed to load transactions.'); }
    } finally { setLoading(false); }
  };

  /* ---- Open modal (fetch full details) ---- */
  const openModal = async (txSummary) => {
    setSelectedTx(txSummary);   // show immediately with summary data
    setModalTab('details');     // always reset to first tab
    setModalLoading(true);
    try {
      const res = await api.get(`/transactions/${txSummary._id}`);
      setSelectedTx(res.data);
    } catch (e) {
      console.warn('Could not fetch full details, using summary:', e.message);
    } finally { setModalLoading(false); }
  };

  /* ---- Modal single-item actions ---- */
  const handleAction = async (status) => {
    if (!selectedTx || !isAdminOrAuditor) return;
    setActionLoading(true);
    try {
      const res = await api.put(`/transactions/${selectedTx._id}/verify`, { status });
      const updated = { ...selectedTx, ...res.data.transaction };
      setSelectedTx(updated);
      setTransactions(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t));
      showToast(`Transaction marked as ${updated.verificationStatus}.`);
    } catch (err) {
      console.error(err);
      showToast('Failed to update transaction status.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTx || !isAdminOrAuditor) return;
    setActionLoading(true);
    try {
      await api.delete(`/transactions/${selectedTx._id}`);
      setTransactions(prev => prev.filter(t => t._id !== selectedTx._id));
      setSelectedTx(null);
      showToast('Transaction deleted.');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete transaction.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  /* ---- Batch action ---- */
  const handleBatchAction = async (action) => {
    if (selected.size === 0 || !isAdminOrAuditor) return;
    const ids = [...selected];
    setActionLoading(true);
    try {
      const res = await api.put('/transactions/batch-action', { ids, action });
      const { results } = res.data;
      await fetchMyTransactions();
      const successCount = results.success.length;
      const blockchained = results.success.filter(r => r.blockchainTxId).length;
      let msg = `Batch ${action}: ${successCount} transactions updated.`;
      if (blockchained) msg += ` ${blockchained} stored on blockchain.`;
      if (results.failed.length) msg += ` ${results.failed.length} failed.`;
      showToast(msg);
    } catch (err) {
      console.error(err); showToast(`Batch ${action} failed.`, 'error');
    } finally {
      setActionLoading(false);
      setSelected(new Set());
    }
  };

  /* ---- Checkbox helpers ---- */
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === currentTransactions.length && currentTransactions.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(currentTransactions.map(t => t._id)));
    }
  };

  /* ---- Filter + paginate ---- */
  const filterByStatus = (list) => {
    switch (statusFilter) {
      case 'verified': return list.filter(t => t.verificationStatus === 'Verified');
      case 'flagged': return list.filter(t => t.verificationStatus === 'Flagged' || t.flagged);
      case 'pending': return list.filter(t => t.verificationStatus === 'Pending');
      case 'suspicious': return list.filter(t => t.verificationStatus === 'Suspicious' || (t.riskScore >= 71 && t.verificationStatus !== 'Verified'));
      case 'rejected': return list.filter(t => t.verificationStatus === 'Rejected');
      default: return list;
    }
  };

  const filteredTransactions = filterByStatus(transactions);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const pendingCount = transactions.filter(t =>
    (t.flagged || (t.riskScore ?? 0) >= 71 || t.verificationStatus === 'Pending' || t.verificationStatus === 'Suspicious') &&
    t.verificationStatus !== 'Verified' && t.verificationStatus !== 'Rejected'
  ).length;

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="my-transactions">

      {/* Toast */}
      {actionMessage.text && (
        <div className={`toast ${actionMessage.type}`}>
          {actionMessage.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
          {actionMessage.text}
        </div>
      )}

      {!embedded && (
        <div className="page-hero transactions-hero">
          <div className="hero-content">
            <span className="hero-tag">TRANSACTION HISTORY</span>
            <h2 className="hero-title" style={{ display: 'flex', alignItems: 'center' }}>
              View all barangay transactions
              {loading && <div className="hero-spinner" />}
            </h2>
            <p className="hero-subtitle">Search, filter, and track transaction records with blockchain verification.</p>
          </div>
          <div className="hero-stats">
            <div className="stat-card">
              <div className="stat-icon"><FileText size={24} color="#3b82f6" /></div>
              <div className="stat-info">
                <div className="stat-value">{transactions.length}</div>
                <div className="stat-label">Total</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><CheckCircle size={24} color="#10b981" /></div>
              <div className="stat-info">
                <div className="stat-value">{transactions.filter(t => t.verificationStatus === 'Verified').length}</div>
                <div className="stat-label">Approved</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon"><Clock size={24} color="#f59e0b" /></div>
              <div className="stat-info">
                <div className="stat-value">{pendingCount}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <form className="filters-section" onSubmit={e => e.preventDefault()}>
        <div className="filter-group" style={{ flex: 2 }}>
          <label>Search Transactions</label>
          <input
            type="text"
            placeholder="Search ID, Payer, Payee, Description..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            style={{ flex: 1, borderRadius: 6 }}
          />
        </div>
        <div className="filter-group">
          <label>From Date</label>
          <input type="date" value={filters.dateFrom} onChange={e => { setFilters(p => ({ ...p, dateFrom: e.target.value })); setCurrentPage(1); }} />
        </div>
        <div className="filter-group">
          <label>To Date</label>
          <input type="date" value={filters.dateTo} onChange={e => { setFilters(p => ({ ...p, dateTo: e.target.value })); setCurrentPage(1); }} />
        </div>
        {/* Sort */}
        <div className="filter-group">
          <label>Sort By</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }} style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.875rem' }}>
              <option value="timestamp">Date</option>
              <option value="riskScore">Risk Score</option>
              <option value="status">Status</option>
            </select>
            <button type="button" onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')}
              style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}>
              <ArrowUpDown size={16} color="#475569" />
            </button>
          </div>
        </div>
        <div className="filter-actions" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button"
            onClick={() => { setSearchInput(''); setFilters({ search: '', dateFrom: '', dateTo: '' }); setStatusFilter('all'); setSortBy('timestamp'); setSortOrder('desc'); }}
            style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="error-banner"><AlertTriangle size={16} /> {error}</div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FileText size={48} color="#94a3b8" /></div>
          <h3>No Transactions Found</h3>
          <p>No transactions match your filters.</p>
        </div>
      ) : (
        <>
          {pendingCount > 0 && (
            <div className="pending-banner">
              <strong>{pendingCount}</strong> transactions awaiting review.
            </div>
          )}

          {/* Toolbar */}
          <div className="transactions-toolbar">
            {/* Status filter chips */}
            <div className="status-filters">
              {[
                { key: 'all', label: 'All' },
                { key: 'verified', label: 'Approved' },
                { key: 'flagged', label: 'Flagged' },
                { key: 'suspicious', label: 'Suspicious' },
                { key: 'pending', label: 'Pending' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`chip-filter ${statusFilter === key ? 'active' : ''}`}
                  onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                  type="button"
                >{label}</button>
              ))}
            </div>
          </div>

          {/* Batch action bar */}
          {isAdminOrAuditor && (
            <div className="batch-toolbar">
              <span className="batch-count"><strong>{selected.size}</strong> selected</span>
              <button className="batch-btn approve" disabled={actionLoading || selected.size === 0} onClick={() => handleBatchAction('approve')}>
                <ThumbsUp size={14} /> Approve All
              </button>
              <button className="batch-btn flag" disabled={actionLoading || selected.size === 0} onClick={() => handleBatchAction('flag')}>
                <Flag size={14} /> Flag All
              </button>
              <button className="batch-btn delete" disabled={actionLoading || selected.size === 0} onClick={() => handleBatchAction('delete')}>
                <Trash2 size={14} /> Delete Selected
              </button>
              <button className="batch-btn cancel" disabled={selected.size === 0} onClick={() => setSelected(new Set())} type="button">
                <X size={14} /> Clear
              </button>
            </div>
          )}

          <div className="transactions-card">
            <table className="transactions-table desktop-table">
              <thead>
                <tr>
                  {isAdminOrAuditor && (
                    <th style={{ width: 40 }}>
                      <input type="checkbox"
                        checked={selected.size === currentTransactions.length && currentTransactions.length > 0}
                        onChange={toggleSelectAll}
                        style={{ width: 16, height: 16 }} />
                    </th>
                  )}
                  <th>ID</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Verification</th>
                  <th>Risk</th>
                  <th>Chain</th>
                </tr>
              </thead>
              <tbody>
                {currentTransactions.map((t) => {
                  const verifiedConfig = {
                    Verified: { color: '#10b981', bg: '#d1fae5', label: 'Verified' },
                    Suspicious: { color: '#f97316', bg: '#ffedd5', label: 'Suspicious' },
                    Flagged: { color: '#f97316', bg: '#ffedd5', label: 'Flagged' },
                    Pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
                    Rejected: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' }
                  };
                  const vBadge = verifiedConfig[t.verificationStatus] || verifiedConfig.Pending;
                  const chainLabel = t.blockchainTxId ? 'Recorded' : 'Not recorded';
                  const chainClass = t.blockchainTxId ? 'chain-recorded' : 'chain-not';
                  return (
                    <tr key={t._id || t.transactionId} onClick={() => openModal(t)} className="clickable-row"
                      style={selected.has(t._id) ? { background: '#eff6ff' } : {}}>
                      {isAdminOrAuditor && (
                        <td onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(t._id)}
                            onChange={() => toggleSelect(t._id)} style={{ width: 16, height: 16 }} />
                        </td>
                      )}
                      <td className="font-mono" style={{ fontWeight: 500 }}>{t.transactionId || t._id}</td>
                      <td>{new Date(t.date || t.timestamp || t.createdAt).toLocaleDateString()}</td>
                      <td className="font-bold">PHP {Number(t.amount || 0).toLocaleString()}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {t.description || t.transactionType || 'N/A'}
                      </td>
                      <td>
                        <span style={{ padding: '0.25rem 0.6rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, backgroundColor: vBadge.bg, color: vBadge.color, display: 'inline-block' }}>
                          {vBadge.label}
                        </span>
                        {t.verifiedBy && <span className="verified-by"> by {t.verifiedBy}</span>}
                      </td>
                      <td><span className={`risk-chip ${riskClass(t.riskScore ?? 0)}`}>{t.riskScore ?? '-'}</span></td>
                      <td><span className={`chain-badge ${chainClass}`}>{chainLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="pagination-btn">
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="pagination-info">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="pagination-btn">
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ====== Transaction Detail Modal ====== */}
          {selectedTx && (
            <div className="tx-modal-overlay" onClick={() => setSelectedTx(null)}>
              <div className="tx-modal tx-modal-wide" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="tx-modal-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h3 style={{ margin: 0 }}>Transaction Details</h3>
                    {selectedTx.staged && (
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontSize: '0.72rem', fontWeight: 700 }}>CSV Import</span>
                    )}
                    {modalLoading && <div style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                  </div>
                  <button className="close-btn" onClick={() => setSelectedTx(null)}>&times;</button>
                </div>

                {/* Risk Gauge - embedded top strip */}
                <div className="risk-gauge-strip">
                  <div className="risk-gauge-strip-gauge">
                    <RiskGauge score={selectedTx.riskScore ?? 0} />
                  </div>
                  <div className="risk-gauge-strip-info">
                    <div className="risk-gauge-strip-title">Live Risk Meter</div>
                    <div className="risk-gauge-strip-score" style={{ color: RISK_COLOR(selectedTx.riskScore ?? 0) }}>
                      {selectedTx.riskScore ?? 0}<span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>/100</span>
                    </div>
                    <div className="risk-gauge-legend">
                      <span><span className="legend-dot" style={{ background: '#10b981' }} /> Low (0-40)</span>
                      <span><span className="legend-dot" style={{ background: '#f59e0b' }} /> Medium (41-70)</span>
                      <span><span className="legend-dot" style={{ background: '#f97316' }} /> High (71-89)</span>
                      <span><span className="legend-dot" style={{ background: '#ef4444' }} /> Critical (90+)</span>
                    </div>
                    <div className="risk-gauge-strip-level" style={{
                      marginTop: 8,
                      background: selectedTx.riskScore >= 90 ? '#fee2e2' : selectedTx.riskScore >= 71 ? '#ffedd5' : selectedTx.riskScore >= 41 ? '#fef3c7' : '#d1fae5',
                      color: selectedTx.riskScore >= 90 ? '#991b1b' : selectedTx.riskScore >= 71 ? '#9a3412' : selectedTx.riskScore >= 41 ? '#92400e' : '#065f46',
                    }}>
                      {selectedTx.riskLevel || 'LOW'}
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                  {[
                    { key: 'details', label: 'Details' },
                    { key: 'ai', label: 'AI Analysis' },
                    { key: 'csv', label: 'Import Data' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      className={`modal-tab-btn ${modalTab === tab.key ? 'active' : ''}`}
                      onClick={() => setModalTab(tab.key)}
                    >{tab.label}</button>
                  ))}
                </div>

                {/* Body */}
                <div className="tx-modal-body tx-modal-body-wide">

                  {/* TAB 1: DETAILS */}
                  {modalTab === 'details' && (
                    <div className="tx-grid">
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>Transaction ID</label>
                          <div className="font-mono">{selectedTx.transactionId || selectedTx._id}</div>
                        </div>
                        <div className="tx-grid-col">
                          <label>Date &amp; Time</label>
                          <div>{new Date(selectedTx.date || selectedTx.timestamp || selectedTx.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>Sender (From)</label>
                          <div className="addr-ellipsis" title={selectedTx.fromAddress}>{formatAddressLabel(selectedTx.fromAddress) || 'N/A'}</div>
                        </div>
                        <div className="tx-grid-col">
                          <label>Receiver (To)</label>
                          <div className="addr-ellipsis" title={selectedTx.toAddress}>{formatAddressLabel(selectedTx.toAddress) || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>Amount</label>
                          <div className="font-bold amount-text">&#8369;{Number(selectedTx.amount || 0).toLocaleString()}</div>
                        </div>
                        <div className="tx-grid-col">
                          <label>Transaction Type</label>
                          <div>{selectedTx.transactionType || selectedTx.type || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>Status</label>
                          <div>
                            {getStatusBadge(selectedTx.verificationStatus || 'Pending')}
                            {selectedTx.verifiedBy && <span className="verified-by"> by {selectedTx.verifiedBy}</span>}
                          </div>
                        </div>
                        <div className="tx-grid-col">
                          <label>Beneficiary Type</label>
                          <div>{selectedTx.beneficiaryType || 'N/A'}</div>
                        </div>
                      </div>
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>AI Combined</label>
                          <div>{selectedTx.mlUsed ? 'Yes' : 'No'}</div>
                        </div>
                        <div className="tx-grid-col">
                          <label>ML Score</label>
                          <div>{selectedTx.mlScore ?? '-'}</div>
                        </div>
                      </div>
                      {(isMeaningfulValue(selectedTx.agency) || isMeaningfulValue(selectedTx.programName)) && (
                        <div className="tx-grid-row">
                          <div className="tx-grid-col">
                            <label>Agency</label>
                            <div>{isMeaningfulValue(selectedTx.agency) ? selectedTx.agency : '-'}</div>
                          </div>
                          <div className="tx-grid-col">
                            <label>Program</label>
                            <div>{isMeaningfulValue(selectedTx.programName) ? selectedTx.programName : '-'}</div>
                          </div>
                        </div>
                      )}
                      <div className="tx-grid-row">
                        <div className="tx-grid-col">
                          <label>Blockchain Status</label>
                          <div className={selectedTx.blockchainTxId ? 'chain-pill recorded' : 'chain-pill not-recorded'}>
                            {selectedTx.blockchainTxId ? 'Recorded on Chain' : 'Not yet recorded'}
                          </div>
                        </div>
                        <div className="tx-grid-col">
                          <label>Block Number</label>
                          <div>{selectedTx.blockNumber ? `#${selectedTx.blockNumber}` : '-'}</div>
                        </div>
                      </div>
                      {selectedTx.blockchainTxId && (
                        <div className="tx-grid-desc">
                          <label><Link2 size={12} style={{ display: 'inline', marginRight: 4 }} />Blockchain Tx Hash</label>
                          <div className="hash-box">{selectedTx.blockchainTxId}</div>
                        </div>
                      )}
                      <div className="tx-grid-desc">
                        <label>Description</label>
                        <p>{selectedTx.description || selectedTx.transactionType || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: AI ANALYSIS */}
                  {modalTab === 'ai' && (
                    <div>
                      <FormulaBreakdown tx={selectedTx} />

                      {(selectedTx.networkFeatures || selectedTx.graphRisk) && (
                        <div className="formula-card" style={{ marginTop: '1rem' }}>
                          <h4 className="formula-title">Network / Graph Risk</h4>
                          <div className="formula-body">
                            {selectedTx.networkFeatures?.degree !== undefined && (
                              <div className="formula-row"><span className="formula-label">Degree</span><span className="formula-val">{selectedTx.networkFeatures.degree}</span></div>
                            )}
                            {selectedTx.networkFeatures?.clusteringCoefficient !== undefined && (
                              <div className="formula-row"><span className="formula-label">Clustering Coeff.</span><span className="formula-val">{selectedTx.networkFeatures.clusteringCoefficient.toFixed(4)}</span></div>
                            )}
                            {selectedTx.networkFeatures?.betweennessCentrality !== undefined && (
                              <div className="formula-row"><span className="formula-label">Betweenness Centrality</span><span className="formula-val">{selectedTx.networkFeatures.betweennessCentrality.toFixed(4)}</span></div>
                            )}
                          </div>
                        </div>
                      )}

                      {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                        <div className="formula-card" style={{ marginTop: '1rem' }}>
                          <h4 className="formula-title">Additional Metadata</h4>
                          <div className="formula-body">
                            {Object.entries(selectedTx.metadata).map(([k, v]) => (
                              <div key={k} className="formula-row">
                                <span className="formula-label">{k}</span>
                                <span className="formula-val">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: CSV / IMPORT DATA */}
                  {modalTab === 'csv' && (
                    <div>
                      <div className="csv-details-banner">
                        <div>
                          <div className="csv-banner-title">CSV Import Source</div>
                          <div className="csv-banner-sub">This transaction was imported from a CSV batch upload and processed through the AI pipeline.</div>
                        </div>
                        {selectedTx.staged && (
                          <span className="csv-staged-badge">Awaiting Approval</span>
                        )}
                      </div>

                      <div className="csv-fields-grid">
                        <div className="csv-field">
                          <div className="csv-field-label">Transaction ID (Original)</div>
                          <div className="csv-field-value font-mono">{selectedTx.transactionId || '-'}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Payer Name (From)</div>
                        <div className="csv-field-value">{formatAddressLabel(selectedTx.fromAddress) || '-'}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Payee Name (To)</div>
                        <div className="csv-field-value">{formatAddressLabel(selectedTx.toAddress) || '-'}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Amount</div>
                          <div className="csv-field-value font-bold">&#8369;{Number(selectedTx.amount || 0).toLocaleString()}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Transaction Type</div>
                          <div className="csv-field-value">{selectedTx.transactionType || '-'}</div>
                        </div>
                        {isMeaningfulValue(selectedTx.agency) && (
                          <div className="csv-field">
                            <div className="csv-field-label">Agency</div>
                            <div className="csv-field-value">{selectedTx.agency}</div>
                          </div>
                        )}
                        {isMeaningfulValue(selectedTx.programName) && (
                          <div className="csv-field">
                            <div className="csv-field-label">Program Name</div>
                            <div className="csv-field-value">{selectedTx.programName}</div>
                          </div>
                        )}
                        <div className="csv-field">
                          <div className="csv-field-label">Beneficiary Type</div>
                          <div className="csv-field-value">{selectedTx.beneficiaryType || '-'}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Currency</div>
                          <div className="csv-field-value">{selectedTx.currency || 'PHP'}</div>
                        </div>
                        <div className="csv-field">
                          <div className="csv-field-label">Post Date</div>
                          <div className="csv-field-value">{new Date(selectedTx.timestamp || selectedTx.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="csv-field" style={{ gridColumn: '1 / -1' }}>
                          <div className="csv-field-label">Description (Raw)</div>
                          <div className="csv-field-value">{selectedTx.description || '-'}</div>
                        </div>
                      </div>

                      <div className="formula-card" style={{ marginTop: '1.25rem' }}>
                        <h4 className="formula-title">AI Pipeline Results</h4>
                        <div className="formula-body">
                          <div className="formula-row"><span className="formula-label">Risk Score</span><span className="formula-val formula-zscore" style={{ color: RISK_COLOR(selectedTx.riskScore ?? 0) }}>{selectedTx.riskScore ?? '-'}/100</span></div>
                          <div className="formula-row"><span className="formula-label">Risk Level</span><span className="formula-val">{selectedTx.riskLevel || '-'}</span></div>
                          <div className="formula-row"><span className="formula-label">Flagged</span><span className="formula-val">{selectedTx.flagged ? 'Yes' : 'No'}</span></div>
                          <div className="formula-row"><span className="formula-label">Verification Status</span><span className="formula-val">{selectedTx.verificationStatus || '-'}</span></div>
                          {selectedTx.blockchainTxId && (
                            <>
                              <div className="formula-row"><span className="formula-label">On-Chain</span><span className="formula-val" style={{ color: '#15803d' }}>Recorded</span></div>
                              <div className="formula-row"><span className="formula-label">Block #</span><span className="formula-val">{selectedTx.blockNumber || '-'}</span></div>
                            </>
                          )}
                        </div>
                      {selectedTx.reasons && selectedTx.reasons.length > 0 && (
                        <div className="formula-patterns">
                          <div className="formula-patterns-title">Reason Why</div>
                          {selectedTx.reasons.map((r, i) => (
                            <div key={i} className="formula-pattern-item">
                              <span className="pattern-desc">{r}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="tx-modal-footer">
                  <div className="tx-modal-actions">
                    {isAdminOrAuditor && (
                      <>
                        <button className="btn-verify" disabled={actionLoading} onClick={() => handleAction('Verified')}>
                          <ThumbsUp size={14} style={{ display: 'inline', marginRight: 4 }} />
                          Approve
                        </button>
                        <button className="btn-flag-action" disabled={actionLoading} onClick={() => handleAction('Rejected')}>
                          <X size={14} style={{ display: 'inline', marginRight: 4 }} />
                          Deny
                        </button>
                        <button className="btn-flag" disabled={actionLoading} onClick={() => handleReject()}>
                          <Trash2 size={14} style={{ display: 'inline', marginRight: 4 }} />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                  <button className="btn-close" onClick={() => setSelectedTx(null)}>Close</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default MyTransactions;
