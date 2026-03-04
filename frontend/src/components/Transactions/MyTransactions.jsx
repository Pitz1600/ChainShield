import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, FileText, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import '../../styles/MyTransactions.css';
import '../../styles/ColorfulIcons.css';

function MyTransactions({ user, embedded = false }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        dateFrom: '',
        dateTo: ''
    });
    const [searchInput, setSearchInput] = useState('');
    const [selectedTx, setSelectedTx] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

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

    const fetchMyTransactions = async () => {
        try {
            setLoading(true);

            // Build query params
            const queryParams = {
                limit: 5000,
                ...(filters.search && { search: filters.search }),
                ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
                ...(filters.dateTo && { dateTo: filters.dateTo })
            };

            const response = await api.get('/transactions/my-transactions', {
                params: queryParams
            });

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

    const isAdminOrAuditor = ['administrator', 'auditor'].includes(user?.role);

    const handleAction = async (status) => {
        if (!selectedTx || !isAdminOrAuditor) return;
        setActionLoading(true);
        try {
            const response = await api.put(`/transactions/${selectedTx._id}/verify`, { status });
            // Update local transaction object
            const updatedTx = { ...selectedTx, verificationStatus: response.data.transaction.verificationStatus, verifiedBy: response.data.transaction.verifiedBy };
            setSelectedTx(updatedTx);

            // Update in list
            setTransactions(prev => prev.map(t => t._id === updatedTx._id ? updatedTx : t));
        } catch (err) {
            console.error('Action failed:', err);
            alert('Failed to update status.');
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            completed: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
            pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
            rejected: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' },
            processing: { color: '#3b82f6', bg: '#dbeafe', label: 'Processing' }
        };

        const config = statusConfig[status] || statusConfig.pending;

        return (
            <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                backgroundColor: config.bg,
                color: config.color
            }}>
                {config.label}
            </span>
        );
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(transactions.length / itemsPerPage);

    // Initial loading state (only when we have no data yet)
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
                            {loading && (
                                <div style={{
                                    marginLeft: '1rem',
                                    width: '18px',
                                    height: '18px',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    borderTopColor: 'white',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                            )}
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
                                <div className="stat-value">{transactions.filter(t => t.status === 'completed').length}</div>
                                <div className="stat-label">Completed</div>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon"><Clock size={24} color="#f59e0b" /></div>
                            <div className="stat-info">
                                <div className="stat-value">{transactions.filter(t => t.status === 'pending').length}</div>
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

            {transactions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><FileText size={48} color="#94a3b8" /></div>
                    <h3>No Transactions Found</h3>
                    <p>You haven't made any transactions yet or no transactions match your filters.</p>
                </div>
            ) : (
                <>
                    <div className="transactions-card">
                        <table className="transactions-table desktop-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Date</th>
                                    <th>Amount</th>
                                    <th>Description</th>
                                    <th>Verified</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentTransactions.map((t) => {
                                    // Helpers
                                    const verifiedConfig = {
                                        Verified: { color: '#10b981', bg: '#d1fae5', label: 'Verified' },
                                        Suspicious: { color: '#ef4444', bg: '#fee2e2', label: 'Suspicious' },
                                        Pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' }
                                    };
                                    const vBadge = verifiedConfig[t.verificationStatus] || verifiedConfig.Pending;

                                    const formatDateWithoutTime = (dateString) => {
                                        const date = new Date(dateString);
                                        return date.toLocaleDateString();
                                    };

                                    return (
                                        <tr key={t._id} onClick={() => setSelectedTx(t)} className="clickable-row">
                                            <td className="font-mono" style={{ fontWeight: 500 }}>{t.transactionId}</td>
                                            <td>{formatDateWithoutTime(t.date)}</td>
                                            <td className="font-bold">₱{t.amount?.toLocaleString()}</td>
                                            <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {t.description || t.type}
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
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

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

                    {/* Transaction Details Modal */}
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
                                                <div className="font-mono">{selectedTx.transactionId}</div>
                                            </div>
                                            <div className="tx-grid-col">
                                                <label>Date</label>
                                                <div>{new Date(selectedTx.date).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div className="tx-grid-row">
                                            <div className="tx-grid-col">
                                                <label>Payer Name</label>
                                                <div>{selectedTx.fromAddress || 'N/A'}</div>
                                            </div>
                                            <div className="tx-grid-col">
                                                <label>Payee Name</label>
                                                <div>{selectedTx.toAddress || 'N/A'}</div>
                                            </div>
                                        </div>
                                        <div className="tx-grid-row">
                                            <div className="tx-grid-col">
                                                <label>Debit Amount</label>
                                                <div className="font-bold amount-text">₱{selectedTx.amount?.toLocaleString()}</div>
                                            </div>
                                            <div className="tx-grid-col">
                                                <label>Credit Amount</label>
                                                <div>₱0.00</div>
                                            </div>
                                        </div>
                                        <div className="tx-grid-row">
                                            <div className="tx-grid-col">
                                                <label>Risk Level</label>
                                                <div>
                                                    <span className={`badge badge-${selectedTx.riskLevel?.toLowerCase() || 'low'}`}>
                                                        {selectedTx.riskLevel || 'LOW'}
                                                    </span>
                                                    {selectedTx.riskScore !== undefined && ` (${selectedTx.riskScore}/100)`}
                                                </div>
                                            </div>
                                            <div className="tx-grid-col">
                                                <label>Verified Status</label>
                                                <div>
                                                    <span className={`v-badge v-${selectedTx.verificationStatus?.toLowerCase() || 'pending'}`}>
                                                        {selectedTx.verificationStatus || 'Pending'}
                                                    </span>
                                                    {selectedTx.verifiedBy && <span className="verified-by"> by {selectedTx.verifiedBy}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="tx-grid-desc">
                                            <label>Description</label>
                                            <p>{selectedTx.description || selectedTx.type}</p>
                                        </div>
                                        <div className="tx-grid-hash">
                                            <label>Blockchain Hash</label>
                                            <div className="hash-box">
                                                {selectedTx.blockchainHash ? (
                                                    <span className="font-mono">{selectedTx.blockchainHash}</span>
                                                ) : <span className="text-muted">Not recorded on blockchain</span>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="tx-modal-footer">
                                    <div className="tx-modal-actions">
                                        {isAdminOrAuditor ? (
                                            <>
                                                {selectedTx.verificationStatus !== 'Verified' && selectedTx.verificationStatus !== 'Suspicious' && (
                                                    <>
                                                        <button className="btn-verify" disabled={actionLoading} onClick={() => handleAction('Verified')}>
                                                            Verify
                                                        </button>
                                                        <button className="btn-flag" disabled={actionLoading} onClick={() => handleAction('Suspicious')}>
                                                            Flag Suspicious
                                                        </button>
                                                    </>
                                                )}
                                                {(selectedTx.verificationStatus === 'Verified' || selectedTx.verificationStatus === 'Suspicious') && (
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
