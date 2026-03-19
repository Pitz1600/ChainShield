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

/* ── helpers ──────────────────────────────────────────────── */
const statusConfig = {
  Verified:   { label: 'Verified',      bg: '#dcfce7', color: '#166534', icon: '✓' },
  Pending:    { label: 'Pending',        bg: '#fef9c3', color: '#854d0e', icon: '…' },
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
  const ITEMS_PER_PAGE = 15;

  const [selectedTx, setSelectedTx]       = useState(null);
  const [showFeedback, setShowFeedback]   = useState(false);
  const [feedbackTx, setFeedbackTx]       = useState(null);

  useLockBodyScroll(Boolean(selectedTx) || showFeedback);

  /* debounce search */
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setCurrentPage(1); }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  /* fetch */
  useEffect(() => { fetchTransactions(); }, [search, statusFilter, dateFrom, dateTo, sortOrder, currentPage]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit:        ITEMS_PER_PAGE,
        page:         currentPage,
        sortBy:       'timestamp',
        sortOrder,
        includeStaged: true,  // residents can see pending staged imports
        ...(search    && { search }),
        ...(dateFrom  && { dateFrom }),
        ...(dateTo    && { dateTo }),
      };

      const res = await api.get('/transactions/my-transactions', { params });
      let txns = res.data.transactions || [];

      /* client-side status filter since backend doesn't support it cleanly */
      if (statusFilter !== 'all') {
        txns = txns.filter(t => {
          const vs = (t.verificationStatus || '').toLowerCase();
          if (statusFilter === 'verified')    return vs === 'verified';
          if (statusFilter === 'pending')     return vs === 'pending' || !t.verificationStatus;
          if (statusFilter === 'flagged')     return vs === 'flagged' || vs === 'suspicious';
          return true;
        });
      }

      setTransactions(txns);
      setTotalCount(res.data.count || txns.length);
      setTotalPages(res.data.totalPages || Math.max(1, Math.ceil((res.data.count || txns.length) / ITEMS_PER_PAGE)));
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
    <div style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ── HEADER ── */}
      {!embedded && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>
            Barangay Transactions
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
            Public spending records for Barangay Pantal — {totalCount} transactions
          </p>
        </div>
      )}

      {/* ── SUMMARY PILLS ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { label: 'All',          key: 'all',      count: totalCount },
          { label: 'Verified',     key: 'verified',  count: transactions.filter(t => t.verificationStatus === 'Verified').length },
          { label: 'Pending',      key: 'pending',   count: transactions.filter(t => !t.verificationStatus || t.verificationStatus === 'Pending').length },
          { label: 'Under Review', key: 'flagged',   count: transactions.filter(t => ['Flagged','Suspicious'].includes(t.verificationStatus)).length },
        ].map(({ label, key, count }) => (
          <button key={key} type="button" onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
            style={{
              padding: '5px 14px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 500,
              border: statusFilter === key ? '1.5px solid #1e40af' : '0.5px solid var(--color-border-tertiary)',
              background: statusFilter === key ? '#eff6ff' : 'var(--color-background-secondary)',
              color: statusFilter === key ? '#1e40af' : 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}>
            {label} {count > 0 && <span style={{ marginLeft: 4, background: statusFilter === key ? '#bfdbfe' : 'var(--color-border-tertiary)', borderRadius: 9999, padding: '1px 6px', fontSize: '0.72rem' }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ position: 'relative', flex: 2, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-secondary)' }} />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by description, payee, ID..."
            style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: '0.85rem', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>From</span>
          <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
            style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: '0.82rem', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>To</span>
          <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
            style={{ padding: '6px 8px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', fontSize: '0.82rem', background: 'var(--color-background-primary)', color: 'var(--color-text-primary)' }} />
        </div>
        <button type="button" onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')}
          title={sortOrder === 'desc' ? 'Newest first' : 'Oldest first'}
          style={{ padding: '7px 10px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          <ArrowUpDown size={14} /> {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
        </button>
        <button type="button" onClick={clearFilters}
          style={{ padding: '7px 12px', borderRadius: 6, border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-secondary)', cursor: 'pointer', fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          Clear
        </button>
      </div>

      {/* ── TABLE ── */}
{loading ? (
  <div style={{ padding: '3rem', textAlign: 'center' }}>
    <div style={{
      width: 36,
      height: 36,
      border: '3px solid #e2e8f0',
      borderTopColor: '#3b82f6',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      margin: '0 auto'
    }} />
    <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
      Loading transactions...
    </p>
  </div>
) : error ? (
  <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444', fontSize: '0.9rem' }}>
    <AlertTriangle size={20} style={{ display: 'inline', marginRight: 6 }} />
    {error}
    <button
      onClick={fetchTransactions}
      style={{
        marginLeft: 12,
        padding: '5px 14px',
        borderRadius: 8,
        border: 'none',
        background: '#ef4444',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '0.8rem'
      }}
    >
      Retry
    </button>
  </div>
) : transactions.length === 0 ? (
  <div style={{ padding: '3rem', textAlign: 'center' }}>
    <FileText size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
    <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
      No transactions found
    </p>
    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
      Try adjusting your filters or check back later.
    </p>
  </div>
) : (
  <>
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      background: '#ffffff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
      marginBottom: '1rem'
    }}>
<table style={{
  width: '100%',
  tableLayout: 'auto', 
  borderCollapse: 'separate',
  borderSpacing: 0,
  fontSize: '0.85rem'
}}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Date', 'Description', 'Type', 'Paid To', 'Amount', 'Status', 'Blockchain'].map(h => (
              <th key={h} style={{
                padding: '12px 16px',
                textAlign: 'left',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {transactions.map((tx) => {
            const st  = getStatus(tx);
            const ch  = chainLabel(tx);
            const amt = Number(tx.amount || 0);

            return (
              <tr
                key={tx._id || tx.transactionId}
                onClick={() => setSelectedTx(tx)}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.transform = 'scale(1.002)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >

                {/* DATE */}
                <td style={{ padding: '14px 16px', color: '#64748b' }}>
                  {new Date(tx.date || tx.timestamp || tx.createdAt)
                    .toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>

                {/* DESCRIPTION */}
                <td style={{ padding: '14px 16px', maxWidth: 240 }}>
                  <div style={{
                    fontWeight: 600,
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {tx.description || tx.transactionType || '—'}
                  </div>
                  {tx.agency && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                      {tx.agency}
                    </div>
                  )}
                </td>

                {/* TYPE */}
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    background: '#f1f5f9',
                    color: '#475569'
                  }}>
                    {friendlyType(tx.type || tx.transactionType)}
                  </span>
                </td>

                {/* PAID TO */}
                <td style={{ padding: '14px 16px', color: '#334155' }}>
                  {formatAddressLabel(tx.toAddress) || '—'}
                </td>

                {/* AMOUNT */}
                <td style={{
                  padding: '14px 16px',
                  fontWeight: 700,
                  color: '#0f172a'
                }}>
                  ₱ {amt.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>

                {/* STATUS */}
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: st.bg,
                    color: st.color
                  }}>
                    {st.icon} {st.label}
                  </span>
                </td>

                {/* BLOCKCHAIN */}
                <td style={{ padding: '14px 16px' }}>
                  <span style={{
                    fontSize: '0.78rem',
                    color: ch.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    <span style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: ch.color
                    }} />
                    {ch.text}
                  </span>
                </td>

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* pagination (unchanged) */}
    {totalPages > 1 && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
          style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #e2e8f0', background: '#fff', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.4 : 1 }}>
          <ChevronLeft size={14} /> Previous
        </button>
        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
          Page {currentPage} of {totalPages}
        </span>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
          style={{ padding: '6px 12px', borderRadius: 6, border: '0.5px solid #e2e8f0', background: '#fff', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.4 : 1 }}>
          Next <ChevronRight size={14} />
        </button>
      </div>
    )}
  </>
)}

{/* ── TRANSACTION MODAL ── */}
{selectedTx && (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15,23,42,0.55)',
      backdropFilter: 'blur(4px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}
    onClick={() => setSelectedTx(null)}
  >
    <div
      style={{
        background: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 520,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 25px 70px rgba(0,0,0,0.25)'
      }}
      onClick={e => e.stopPropagation()}
    >

      {/* header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 22px',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            Transaction Details
          </h3>
          <p style={{
            margin: '3px 0 0',
            fontSize: '0.72rem',
            color: '#94a3b8',
            fontFamily: 'monospace'
          }}>
            {selectedTx.transactionId || selectedTx._id}
          </p>
        </div>

        <button
          onClick={() => setSelectedTx(null)}
          style={{
            background: '#f1f5f9',
            border: 'none',
            padding: 7,
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* status banner */}
      {(() => {
  const vs = selectedTx.verificationStatus;
  const st = getStatus(selectedTx);

  const config =
    vs === 'Verified' ? {
      bg: '#ecfdf5',
      border: '#bbf7d0',
      iconBg: '#22c55e'
    } :
    vs === 'Rejected' ? {
      bg: '#fef2f2',
      border: '#fecaca',
      iconBg: '#ef4444'
    } :
    vs === 'Flagged' || vs === 'Suspicious' ? {
      bg: '#fff7ed',
      border: '#fed7aa',
      iconBg: '#f97316'
    } : {
      bg: '#fefce8',
      border: '#fde68a',
      iconBg: '#eab308'
    };

  const msg =
    vs === 'Verified'
      ? 'This transaction has been officially approved.'
      : vs === 'Rejected'
      ? 'This transaction was not approved.'
      : vs === 'Flagged' || vs === 'Suspicious'
      ? 'This transaction is under review.'
      : 'This transaction is awaiting review.';

  return (
    <div style={{
      margin: '14px 18px 0',
      padding: '12px 14px',
      borderRadius: 12,
      background: config.bg,
      border: `1px solid ${config.border}`,
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }}>

      {/* icon circle */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: config.iconBg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: 700
      }}>
        {st.icon}
      </div>

      {/* text */}
      <div style={{ lineHeight: 1.3 }}>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#0f172a'
        }}>
          {st.label}
        </div>

        <div style={{
          fontSize: '0.78rem',
          color: '#64748b',
          marginTop: 2
        }}>
          {msg}
        </div>
      </div>

    </div>
  );
})()}

      {/* body */}
      <div style={{ padding: '20px' }}>

        {/* amount highlight */}
        <div style={{
          background: '#f8fafc',
          borderRadius: 12,
          padding: '16px',
          textAlign: 'center',
          marginBottom: 18
        }}>
          <div style={{
            fontSize: '0.7rem',
            color: '#64748b',
            marginBottom: 6,
            textTransform: 'uppercase',
            fontWeight: 600
          }}>
            Total Amount
          </div>

          <div style={{
            fontSize: '2rem',
            fontWeight: 800,
            color: '#0f172a'
          }}>
            ₱ {Number(selectedTx.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'What was paid for', value: selectedTx.description || selectedTx.transactionType || '—' },
            { label: 'Transaction type', value: friendlyType(selectedTx.type || selectedTx.transactionType) },
            { label: 'Paid to', value: formatAddressLabel(selectedTx.toAddress) || '—' },
            { label: 'Paid by', value: formatAddressLabel(selectedTx.fromAddress) || selectedTx.agency || '—' },
            {
              label: 'Date',
              value: new Date(selectedTx.date || selectedTx.timestamp || selectedTx.createdAt)
                .toLocaleDateString('en-PH', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
            },
            ...(selectedTx.agency ? [{ label: 'Office / Agency', value: selectedTx.agency }] : []),
            ...(selectedTx.programName ? [{ label: 'Program / Budget', value: selectedTx.programName }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                {label}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 500, color: '#0f172a' }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* blockchain */}
        <div style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Blockchain record
          </span>
          {(() => {
            const ch = chainLabel(selectedTx);
            return (
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: ch.color,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: ch.color
                }} />
                {ch.text}
              </span>
            );
          })()}
        </div>

        {/* button */}
        <button
          onClick={() => openFeedback(selectedTx)}
          style={{
            width: '100%',
            marginTop: 20,
            padding: '13px',
            borderRadius: 10,
            border: 'none',
            background: '#1e40af',
            color: '#fff',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Report a concern
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