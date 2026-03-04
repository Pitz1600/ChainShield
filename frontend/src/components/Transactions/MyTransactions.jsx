import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, FileText, ChevronLeft, ChevronRight, Grid, List } from 'lucide-react';
import api from '../../services/api';
import '../../styles/MyTransactions.css';
import '../../styles/ColorfulIcons.css';

function MyTransactions({ user, embedded = false }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '' });
  const [searchInput, setSearchInput] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [actionMessage, setActionMessage] = useState('');
  const TOAST_DURATION = 4000;
  const [statusFilter, setStatusFilter] = useState('all'); // all | verified | flagged | pending | rejected
  const [viewMode, setViewMode] = useState('cards'); // cards | table

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => {
        if (prev.search !== searchInput) {
          setCurrentPage(1);
          return { ...prev, search: searchInput };
        }
        return prev;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchMyTransactions();
  }, [filters, currentPage]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'tx_refresh') {
        fetchMyTransactions();
        setActionMessage('Transactions updated from recent approval/flag/deny.');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Auto-clear toast after a short delay
  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(''), TOAST_DURATION);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  // Load data
  const fetchMyTransactions = async () => {
    try {
      setLoading(true);
      const queryParams = {
        limit: 5000,
        ...(filters.search && { search: filters.search }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      };
      const response = await api.get('/transactions/my-transactions', { params: queryParams });
      setTransactions(response.data.transactions || []);
    } catch (err) {
      if (err.response?.status === 404) {
        setTransactions([]);
      } else {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transactions. Please check your connection.');
        setTransactions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const isAdminOrAuditor = ['administrator', 'auditor', 'barangay_official'].includes(user?.role);

  const handleAction = async (status) => {
    if (!selectedTx || !isAdminOrAuditor) return;
    setActionLoading(true);
    try {
      const response = await api.put(`/transactions/${selectedTx._id}/verify`, { status });
      const updatedTx = { ...selectedTx, verificationStatus: response.data.transaction.verificationStatus, verifiedBy: response.data.transaction.verifiedBy };
      setSelectedTx(updatedTx);
      setTransactions(prev => prev.map(t => t._id === updatedTx._id ? updatedTx : t));
      setActionMessage(`Marked ${updatedTx.transactionId} as ${updatedTx.verificationStatus}.`);
    } catch (err) {
      console.error('Action failed:', err);
      alert('Failed to update status.');
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
      setActionMessage('Transaction removed.');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete transaction.');
    } finally {
      setActionLoading(false);
    }
  };

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
        padding: '0.25rem 0.75rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: '600',
        backgroundColor: config.bg,
        color: config.color
      }}>{config.label}</span>
    );
  };

  const pendingTransactions = transactions.filter(t =>
    (t.flagged || (t.riskScore ?? 0) >= 60 || t.verificationStatus === 'Pending' || t.verificationStatus === 'Suspicious') &&
    t.verificationStatus !== 'Verified' &&
    t.verificationStatus !== 'Rejected'
  );

  const filterByStatus = (list) => {
    switch (statusFilter) {
      case 'verified': return list.filter(t => t.verificationStatus === 'Verified');
      case 'flagged': return list.filter(t => t.verificationStatus === 'Flagged' || t.flagged);
      case 'pending': return list.filter(t => t.verificationStatus === 'Pending' || t.verificationStatus === 'Suspicious');
      case 'rejected': return list.filter(t => t.verificationStatus === 'Rejected');
      default: return list;
    }
  };

  const filteredTransactions = filterByStatus(transactions);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const shortenAddress = (addr) => {
    if (!addr) return 'N/A';
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
  };

  const riskClass = (score) => {
    if (score >= 80) return 'risk-critical';
    if (score >= 60) return 'risk-high';
    if (score >= 40) return 'risk-medium';
    return 'risk-low';
  };

  if (loading && transactions.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading transactions...</p>
      </div>
    );
  }

  return (
    <div className="my-transactions">
      {!embedded && (
        <div className="page-hero transactions-hero">
          <div className="hero-content">
            <span className="hero-tag">TRANSACTION HISTORY</span>
            <h2 className="hero-title" style={{ display: 'flex', alignItems: 'center' }}>
              View all barangay transactions
              {loading && <div className="hero-spinner"></div>}
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
                <div className="stat-value">{pendingTransactions.length}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <form className="filters-section" onSubmit={(e) => e.preventDefault()}>
        <div className="filter-group" style={{ flex: 2 }}>
          <label>Search Transactions</label>
          <div className="search-input-wrapper" style={{ display: 'flex' }}>
            <input
              type="text"
              placeholder="Search ID, Payer, Payee, Description..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ flex: 1, borderRadius: '6px' }}
            />
          </div>
        </div>

        <div className="filter-group">
          <label>From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => { handleFilterChange('dateTo', e.target.value); fetchMyTransactions(); }}
          />
        </div>
        <div className="filter-actions" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={() => { setSearchInput(''); setFilters({ search: '', dateFrom: '', dateTo: '' }); setTimeout(fetchMyTransactions, 0); }} style={{ padding: '0.5rem 1rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
      </form>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {actionMessage && (
        <div className="toast success">
          <CheckCircle size={16} /> {actionMessage}
        </div>
      )}

      {transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><FileText size={48} color="#94a3b8" /></div>
          <h3>No Transactions Found</h3>
          <p>You haven't made any transactions yet or no transactions match your filters.</p>
        </div>
      ) : (
        <>
          {pendingTransactions.length > 0 && (
            <div className="pending-banner">
              <strong>{pendingTransactions.length}</strong> pending transactions awaiting approval.
            </div>
          )}

          <div className="transactions-toolbar">
            <div className="status-filters">
              {['all', 'verified', 'flagged', 'pending', 'rejected'].map((key) => {
                const labelMap = { all: 'All', verified: 'Approved', flagged: 'Flagged', pending: 'Pending', rejected: 'Denied' };
                return (
                  <button
                    key={key}
                    className={`chip-filter ${statusFilter === key ? 'active' : ''}`}
                    onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                    type="button"
                  >
                    {labelMap[key]}
                  </button>
                );
              })}
            </div>
            <div className="view-toggle">
              <button className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`} onClick={() => setViewMode('cards')} type="button">
                <Grid size={16} /> Cards
              </button>
              <button className={`view-btn ${viewMode === 'table' ? 'active' : ''}`} onClick={() => setViewMode('table')} type="button">
                <List size={16} /> Table
              </button>
            </div>
          </div>

          {viewMode === 'cards' ? (
            <div className="tx-card-grid">
              {currentTransactions.map((t) => {
                const statusLabel = t.verificationStatus || (t.flagged ? 'Flagged' : 'Pending');
                const chainLabel = t.blockchainTxId ? 'Recorded' : 'Not recorded';
                return (
                  <div key={t._id || t.transactionId} className="tx-card" onClick={() => setSelectedTx(t)}>
                    <div className="tx-card-top">
                      <span className={`risk-pill ${riskClass(t.riskScore || 0)}`}>{t.riskScore ?? 0}</span>
                      <div className="tx-card-status">
                        {getStatusBadge(statusLabel)}
                        <span className={`chain-pill ${t.blockchainTxId ? 'recorded' : 'not-recorded'}`}>{chainLabel}</span>
                      </div>
                    </div>
                    <div className="tx-card-id">{t.transactionId || t._id}</div>
                    <div className="tx-card-meta">
                      <div><strong>Type:</strong> {t.transactionType || 'N/A'}</div>
                      <div><strong>From:</strong> <span className="addr-ellipsis">{shortenAddress(t.fromAddress)}</span></div>
                      <div><strong>To:</strong> <span className="addr-ellipsis">{shortenAddress(t.toAddress)}</span></div>
                      <div><strong>Amount:</strong> ₱{Number(t.amount || 0).toLocaleString()}</div>
                      <div><strong>Date:</strong> {new Date(t.date || t.timestamp || t.createdAt).toLocaleDateString()}</div>
                      {t.verifiedBy && <div><strong>Verified By:</strong> {t.verifiedBy}</div>}
                    </div>
                    <div className="tx-card-actions">
                      <button className="btn-outline" onClick={(e) => { e.stopPropagation(); setSelectedTx(t); }}>View</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="transactions-card">
              <table className="transactions-table desktop-table">
                <thead>
                  <tr>
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
                      Suspicious: { color: '#f97316', bg: '#ffedd5', label: 'Pending Review' },
                      Pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending Review' },
                      Rejected: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' }
                    };
                    const vBadge = verifiedConfig[t.verificationStatus] || verifiedConfig.Pending;
                    const chainLabel = t.blockchainTxId ? 'Recorded' : 'Not recorded';
                    const chainClass = t.blockchainTxId ? 'chain-recorded' : 'chain-not';
                    return (
                      <tr key={t._id || t.transactionId} onClick={() => setSelectedTx(t)} className="clickable-row">
                        <td className="font-mono" style={{ fontWeight: 500 }}>{t.transactionId || t._id}</td>
                        <td>{new Date(t.date || t.timestamp || t.createdAt).toLocaleDateString()}</td>
                        <td className="font-bold">₱{Number(t.amount || 0).toLocaleString()}</td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.description || t.transactionType || 'N/A'}
                        </td>
                        <td>
                          <span style={{
                            padding: '0.25rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            backgroundColor: vBadge.bg,
                            color: vBadge.color,
                            display: 'inline-block'
                          }}>
                            {vBadge.label}
                          </span>
                          {t.verifiedBy && <span className="verified-by"> by {t.verifiedBy}</span>}
                        </td>
                        <td>
                          <span className={`risk-chip ${riskClass(t.riskScore ?? 0)}`}>
                            {t.riskScore ?? '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`chain-badge ${chainClass}`}>{chainLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="pagination-btn"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="pagination-btn"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}

          {selectedTx && (
            <div className="tx-modal-overlay">
              <div className="tx-modal">
                <div className="tx-modal-header">
                  <h3>Transaction Details</h3>
                  <button className="close-btn" onClick={() => setSelectedTx(null)}>&times;</button>
                </div>
                <div className="tx-modal-body">
                  <div className="tx-grid">
                    <div className="tx-grid-row">
                      <div className="tx-grid-col">
                        <label>ID</label>
                        <div className="font-mono">{selectedTx.transactionId || selectedTx._id}</div>
                      </div>
                      <div className="tx-grid-col">
                        <label>Date</label>
                        <div>{new Date(selectedTx.date || selectedTx.timestamp || selectedTx.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="tx-grid-row">
                      <div className="tx-grid-col">
                        <label>From</label>
                        <div className="addr-ellipsis">{shortenAddress(selectedTx.fromAddress)}</div>
                      </div>
                      <div className="tx-grid-col">
                        <label>To</label>
                        <div className="addr-ellipsis">{shortenAddress(selectedTx.toAddress)}</div>
                      </div>
                    </div>
                    <div className="tx-grid-row">
                      <div className="tx-grid-col">
                        <label>Amount</label>
                        <div className="font-bold amount-text">₱{Number(selectedTx.amount || 0).toLocaleString()}</div>
                      </div>
                      <div className="tx-grid-col">
                        <label>Risk</label>
                        <div>
                          <span className={`badge badge-${(selectedTx.riskLevel || 'LOW').toLowerCase()}`}>
                            {selectedTx.riskLevel || 'LOW'}
                          </span>
                          {selectedTx.riskScore !== undefined && ` (${selectedTx.riskScore}/100)`}
                        </div>
                      </div>
                    </div>
                    <div className="tx-grid-row">
                      <div className="tx-grid-col">
                        <label>Verification</label>
                        <div>
                          {getStatusBadge(selectedTx.verificationStatus || 'Pending')}
                          {selectedTx.verifiedBy && <span className="verified-by"> by {selectedTx.verifiedBy}</span>}
                        </div>
                      </div>
                      <div className="tx-grid-col">
                        <label>Blockchain</label>
                        <div className={selectedTx.blockchainTxId ? 'chain-pill recorded' : 'chain-pill not-recorded'}>
                          {selectedTx.blockchainTxId ? 'Recorded' : 'Not recorded'}
                        </div>
                      </div>
                    </div>
                    <div className="tx-grid-desc">
                      <label>Description</label>
                      <p>{selectedTx.description || selectedTx.transactionType || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="tx-modal-footer">
                  <div className="tx-modal-actions">
                    {isAdminOrAuditor ? (
                      <>
                        {(selectedTx.verificationStatus === 'Pending' || selectedTx.verificationStatus === 'Suspicious') && (
                          <>
                            <button className="btn-verify" disabled={actionLoading} onClick={() => handleAction('Verified')}>
                              Approve & Record (if flagged)
                            </button>
                            <button className="btn-flag" disabled={actionLoading} onClick={() => handleReject()}>
                              Deny & Delete
                            </button>
                          </>
                        )}
                        {(selectedTx.verificationStatus === 'Verified' || selectedTx.verificationStatus === 'Rejected') && (
                          <button className="btn-undo" disabled={actionLoading} onClick={() => handleAction('Pending')}>
                            Undo Action
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-muted text-sm">Action restricted to Auditors/Admins</div>
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
