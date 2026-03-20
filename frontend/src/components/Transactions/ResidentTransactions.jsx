import React, { useState, useEffect } from 'react';
import {
  Search, ChevronLeft, ChevronRight, X,
  CheckCircle, Clock, AlertTriangle, ShieldCheck,
  ArrowUpDown, FileText, MessageSquare
} from 'lucide-react';
import api from '../../services/api';
import FeedbackModal from '../Feedbacks/FeedbackModal';
import useLockBodyScroll from '../../utils/useLockBodyScroll';
import { formatAddressLabel } from '../../utils/helpers';
import '../../styles/MyTransactions.css';
import '../../styles/TransactionsPage.css';

/* ── helpers ──────────────────────────────────────────────── */
const statusConfig = {
  Verified:   { label: 'Approved',       bg: '#dcfce7', color: '#166534', icon: '✓' },
  Pending:    { label: 'Approved',       bg: '#dcfce7', color: '#166534', icon: '✓' },
  Flagged:    { label: 'Under Review',   bg: '#ffedd5', color: '#9a3412', icon: '⚠' },
  Suspicious: { label: 'Under Review',   bg: '#ffedd5', color: '#9a3412', icon: '⚠' },
  Rejected:   { label: 'Not Approved',   bg: '#fee2e2', color: '#991b1b', icon: '✕' },
};

const getStatus = (tx) => statusConfig[tx.verificationStatus] || statusConfig.Pending;

const friendlyType = (type) => {
  const map = {
    'Social Welfare': 'Social Welfare',
    'Procurement':    'Procurement',
    'Grant':          'Grant / Subsidy',
    'Tax':            'Tax / Revenue',
    'Revenue':        'Revenue',
    'Other':          'General Expense',
  };
  return map[type] || type || 'General Expense';
};

const chainLabel = (tx) => {
  if (tx.blockchainTxId || tx.blockchainHash) return { text: 'Blockchain verified', color: '#166534' };
  return { text: 'Not yet recorded', color: '#94a3b8' };
};

/* ── main component ───────────────────────────────────────── */
function ResidentTransactions({ user, embedded = false }) {
  const [transactions, setTransactions]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const [searchInput, setSearchInput]     = useState('');
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [sortOrder, setSortOrder]         = useState('desc');

  const [currentPage, setCurrentPage]     = useState(1);
  const [totalPages, setTotalPages]       = useState(1);
  const [totalCount, setTotalCount]       = useState(0);
  const [chipCounts, setChipCounts]       = useState({ all: 0, approved: 0, flagged: 0 });
  const ITEMS_PER_PAGE = 20;

  const [selectedTx, setSelectedTx]       = useState(null);
  const [showFeedback, setShowFeedback]   = useState(false);
  const [feedbackTx, setFeedbackTx]       = useState(null);

  useLockBodyScroll(Boolean(selectedTx) || showFeedback);

  /* fetch chip counts once on mount */
  useEffect(() => {
    const fetchChipCounts = async () => {
      try {
        const [all, approved, flagged] = await Promise.all([
          api.get('/transactions/my-transactions', { params: { limit: 1, page: 1, includeStaged: true } }),
          api.get('/transactions/my-transactions', { params: { limit: 1, page: 1, status: 'Verified,Pending', includeStaged: true } }),
          api.get('/transactions/my-transactions', { params: { limit: 1, page: 1, status: 'Flagged,Suspicious', includeStaged: true } }),
        ]);
        setChipCounts({
          all:      all.data.count      || 0,
          approved: approved.data.count || 0,
          flagged:  flagged.data.count  || 0,
        });
      } catch (_) { /* silent */ }
    };
    fetchChipCounts();
  }, []);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* fetch — re-run whenever any filter or page changes */
  useEffect(() => { fetchTransactions(); }, [search, statusFilter, dateFrom, dateTo, sortOrder, currentPage]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Map UI chip keys → backend verificationStatus values
      // "flagged" chip = both Flagged AND Suspicious (Under Review)
      const statusMap = {
        verified:   'Verified,Pending',
        flagged:    'Flagged,Suspicious',   // comma-separated → $in query
        rejected:   'Rejected',
      };

      const params = {
        limit:     ITEMS_PER_PAGE,
        page:      currentPage,
        sortBy:    'timestamp',
        sortOrder,
        includeStaged: true,
        ...(search                          && { search }),
        ...(dateFrom                        && { dateFrom }),
        ...(dateTo                          && { dateTo }),
        ...(statusFilter && statusFilter !== 'all' && { status: statusMap[statusFilter] || statusFilter }),
      };

      const res = await api.get('/transactions/my-transactions', { params });
      const txns = res.data.transactions || [];

      setTransactions(txns);
      setTotalCount(res.data.count || txns.length);
      setTotalPages(
        res.data.totalPages ||
        Math.max(1, Math.ceil((res.data.count || txns.length) / ITEMS_PER_PAGE))
      );
    } catch (err) {
      console.error('ResidentTransactions fetch error:', err);
      setError('Could not load transactions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchInput(''); setSearch('');
    setStatusFilter('all');
    setDateFrom(''); setDateTo('');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const openFeedback = (tx) => {
    setFeedbackTx({
      transactionId:  tx.transactionId,
      transactionRef: tx._id,
      agency:         tx.agency,
      programName:    tx.programName,
      amount:         tx.amount,
      transactionType: tx.type || tx.transactionType,
      timestamp:      tx.date || tx.timestamp || tx.createdAt,
    });
    setShowFeedback(true);
    setSelectedTx(null);
  };

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div className="my-transactions">

      {/* ── SUMMARY CHIPS ── */}
      <div className="transactions-toolbar" style={{ marginBottom: '0.75rem' }}>
        <div className="status-filters">
          {[
            { label: 'All',          key: 'all',      count: chipCounts.all },
            { label: 'Approved',     key: 'verified', count: chipCounts.approved },
            { label: 'Under Review', key: 'flagged',  count: chipCounts.flagged },
          ].map(({ label, key, count }) => (
            <button key={key} type="button"
              className={`chip-filter ${statusFilter === key ? 'active' : ''}`}
              onClick={() => { setCurrentPage(1); setStatusFilter(key); }}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {label}
              {count > 0 && (
                <span style={{
                  background: statusFilter === key ? 'rgba(255,255,255,0.3)' : '#e2e8f0',
                  color: statusFilter === key ? '#fff' : '#64748b',
                  fontSize: '0.68rem', fontWeight: 700,
                  padding: '1px 6px', borderRadius: 99, minWidth: 18, textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── FILTERS ── */}
      <form className="filters-section" onSubmit={e => e.preventDefault()}>
        <div className="filter-group" style={{ flex: 2 }}>
          <label>Search Transactions</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)', pointerEvents: 'none' }} />
            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by description, payee, ID..."
              style={{ paddingLeft: 30, width: '100%' }} />
          </div>
        </div>
        <div className="filter-group">
          <label>From Date</label>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="filter-group">
          <label>To Date</label>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }} />
        </div>
        <div className="filter-group">
          <label>Sort</label>
          <button type="button" onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')}
            style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: '#475569' }}>
            <ArrowUpDown size={14} /> {sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
        <div className="filter-actions" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={clearFilters}
            style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </form>

      {/* ── TABLE ── */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>Loading transactions...</p>
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontSize: '0.9rem' }}>
          <AlertTriangle size={20} style={{ display: 'inline', marginRight: 6 }} />{error}
          <button onClick={fetchTransactions} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 6, border: '0.5px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>Retry</button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FileText size={48} color="#94a3b8" /></div>
          <h3>No Transactions Found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <>
          <div className="transactions-card">
            <table className="transactions-table desktop-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Paid To</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Blockchain</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const st  = getStatus(tx);
                  const ch  = chainLabel(tx);
                  const amt = Number(tx.amount || 0);
                  return (
                    <tr key={tx._id || tx.transactionId}
                      onClick={() => setSelectedTx(tx)}
                      className="clickable-row">
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {new Date(tx.date || tx.timestamp || tx.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ maxWidth: 200 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                          {tx.description || tx.transactionType || '—'}
                        </div>
                        {tx.agency && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{tx.agency}</div>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 500, background: '#f1f5f9', color: '#475569' }}>
                          {friendlyType(tx.type || tx.transactionType)}
                        </span>
                      </td>
                      <td style={{ maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#475569' }}>
                        {formatAddressLabel(tx.toAddress) || '—'}
                      </td>
                      <td className="font-bold" style={{ whiteSpace: 'nowrap' }}>
                        ₱ {amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span style={{ padding: '3px 10px', borderRadius: 9999, fontSize: '0.75rem', fontWeight: 600, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                          {st.icon} {st.label}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '0.78rem', color: ch.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                          {ch.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
        </>
      )}

      {/* ── TRANSACTION MODAL ── */}
      {selectedTx && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setSelectedTx(null)}>
          <div style={{ background: '#ffffff', borderRadius: 12, width: '100%', maxWidth: 500, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
            onClick={e => e.stopPropagation()}>

            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>Transaction Details</h3>
                <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '2px 0 0', fontFamily: 'monospace' }}>{selectedTx.transactionId || selectedTx._id}</p>
              </div>
              <button onClick={() => setSelectedTx(null)}
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#475569', padding: '6px', borderRadius: 6, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>

            {/* status banner */}
            {(() => {
              const vs = selectedTx.verificationStatus;
              const bannerBg  = vs === 'Verified'                           ? '#f0fdf4'
                              : vs === 'Rejected'                           ? '#fef2f2'
                              : vs === 'Flagged' || vs === 'Suspicious'     ? '#fff7ed'
                              : '#fefce8';
              const bannerBd  = vs === 'Verified'                           ? '#bbf7d0'
                              : vs === 'Rejected'                           ? '#fecaca'
                              : vs === 'Flagged' || vs === 'Suspicious'     ? '#fed7aa'
                              : '#fef08a';
              const st = getStatus(selectedTx);
              const msg = vs === 'Verified'                            ? 'This transaction has been officially approved.'
                        : vs === 'Flagged' || vs === 'Suspicious'      ? 'This transaction is being reviewed by the barangay.'
                        : vs === 'Rejected'                            ? 'This transaction was not approved.'
                        : 'This transaction is awaiting official review.';
              return (
                <div style={{ padding: '12px 20px', background: bannerBg, borderBottom: `1px solid ${bannerBd}`, display: 'flex', gap: 10 }}>
                  <span style={{ fontSize: '1.1rem', lineHeight: 1.4 }}>{st.icon}</span>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700, color: st.color }}>{st.label}</div>
                    <div style={{ fontSize: '0.78rem', color: st.color, opacity: 0.85, marginTop: 2 }}>{msg}</div>
                  </div>
                </div>
              );
            })()}

            {/* body */}
            <div style={{ padding: '20px' }}>

              {/* amount hero */}
              <div style={{ textAlign: 'center', padding: '14px 0 18px', borderBottom: '1px solid #f1f5f9', marginBottom: 14 }}>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Total Amount</div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
                  ₱ {Number(selectedTx.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </div>
              </div>

              {/* rows */}
              {[
                { label: 'What was paid for', value: selectedTx.description || selectedTx.transactionType || '—' },
                { label: 'Transaction type',  value: friendlyType(selectedTx.type || selectedTx.transactionType) },
                { label: 'Paid to',           value: formatAddressLabel(selectedTx.toAddress) || '—' },
                { label: 'Paid by',           value: formatAddressLabel(selectedTx.fromAddress) || selectedTx.agency || '—' },
                { label: 'Date',              value: new Date(selectedTx.date || selectedTx.timestamp || selectedTx.createdAt).toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
                ...(selectedTx.agency      ? [{ label: 'Office / Agency',  value: selectedTx.agency }]      : []),
                ...(selectedTx.programName ? [{ label: 'Program / Budget', value: selectedTx.programName }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid #f8fafc', gap: 16 }}>
                  <span style={{ fontSize: '0.82rem', color: '#64748b', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#1e293b', textAlign: 'right', wordBreak: 'break-word', maxWidth: 280 }}>{value}</span>
                </div>
              ))}

              {/* blockchain */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', marginBottom: 18 }}>
                <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Blockchain record</span>
                {(() => {
                  const ch = chainLabel(selectedTx);
                  return (
                    <span style={{ fontSize: '0.82rem', fontWeight: 500, color: ch.color, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: ch.color, flexShrink: 0 }} />
                      {ch.text}
                    </span>
                  );
                })()}
              </div>

              {/* report button */}
              <button onClick={() => openFeedback(selectedTx)}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1.5px solid #1e40af', background: 'transparent', color: '#1e40af', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <MessageSquare size={15} />
                Report a concern about this transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FEEDBACK MODAL ── */}
      {showFeedback && (
        <FeedbackModal
          transactionMeta={feedbackTx}
          onClose={() => { setShowFeedback(false); setFeedbackTx(null); }}
          onSuccess={() => { setShowFeedback(false); setFeedbackTx(null); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

export default ResidentTransactions;
