import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Clock, FileText, Search, Filter } from 'lucide-react';
import '../../styles/MyTransactions.css';
import '../../styles/ColorfulIcons.css';

function MyTransactions({ user, embedded = false }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        type: 'all',
        status: 'all',
        dateFrom: '',
        dateTo: ''
    });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchMyTransactions();
    }, [filters]);

    const fetchMyTransactions = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            // Build query string
            const params = new URLSearchParams();
            if (filters.type !== 'all') params.append('type', filters.type);
            if (filters.status !== 'all') params.append('status', filters.status);
            if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.append('dateTo', filters.dateTo);

            const response = await fetch(`http://localhost:5000/api/transactions/my-transactions?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setTransactions(data.transactions || []);
            } else if (response.status === 404) {
                // Endpoint doesn't exist yet, use mock data
                setTransactions(getMockTransactions());
            } else {
                setError('Failed to load transactions');
            }
        } catch (err) {
            // Use mock data for now
            setTransactions(getMockTransactions());
        } finally {
            setLoading(false);
        }
    };

    const getMockTransactions = () => {
        return [
            {
                _id: '1',
                transactionId: 'TXN-2024-001',
                type: 'Barangay Clearance',
                amount: 50,
                status: 'completed',
                date: new Date('2024-01-15'),
                blockchainHash: '0x1234567890abcdef...'
            },
            {
                _id: '2',
                transactionId: 'TXN-2024-002',
                type: 'Business Permit',
                amount: 500,
                status: 'pending',
                date: new Date('2024-01-20'),
                blockchainHash: null
            },
            {
                _id: '3',
                transactionId: 'TXN-2024-003',
                type: 'Cedula',
                amount: 30,
                status: 'completed',
                date: new Date('2024-01-10'),
                blockchainHash: '0xabcdef1234567890...'
            }
        ];
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setCurrentPage(1);
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

    if (loading) {
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
                        <h2 className="hero-title">View all barangay transactions</h2>
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

            <div className="filters-section">
                <div className="filter-group">
                    <label>Transaction Type</label>
                    <select
                        value={filters.type}
                        onChange={(e) => handleFilterChange('type', e.target.value)}
                    >
                        <option value="all">All Types</option>
                        <option value="Barangay Clearance">Barangay Clearance</option>
                        <option value="Business Permit">Business Permit</option>
                        <option value="Cedula">Cedula</option>
                        <option value="Certificate">Certificate</option>
                        <option value="Payment">Payment</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Status</label>
                    <select
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="rejected">Rejected</option>
                    </select>
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
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {transactions.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h3>No Transactions Found</h3>
                    <p>You haven't made any transactions yet or no transactions match your filters.</p>
                </div>
            ) : (
                <>
                    <div className="transactions-card">
                        <table className="transactions-table">
                            <thead>
                                <tr>
                                    <th>Transaction ID</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Blockchain Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentTransactions.map((t) => {
                                    // Helper to get status config
                                    const statusConfig = {
                                        completed: { color: '#10b981', bg: '#d1fae5', label: 'Completed' },
                                        pending: { color: '#f59e0b', bg: '#fef3c7', label: 'Pending' },
                                        rejected: { color: '#ef4444', bg: '#fee2e2', label: 'Rejected' },
                                        processing: { color: '#3b82f6', bg: '#dbeafe', label: 'Processing' }
                                    };
                                    const badge = statusConfig[t.status] || statusConfig.pending;

                                    return (
                                        <tr key={t._id}>
                                            <td className="font-mono" style={{ fontWeight: 500 }}>{t.transactionId}</td>
                                            <td>{t.type}</td>
                                            <td className="font-bold">₱{t.amount?.toLocaleString()}</td>
                                            <td>{new Date(t.date).toLocaleDateString()}</td>
                                            <td>
                                                <span style={{
                                                    padding: '0.25rem 0.75rem',
                                                    borderRadius: '9999px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '600',
                                                    backgroundColor: badge.bg,
                                                    color: badge.color,
                                                    display: 'inline-block'
                                                }}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td>
                                                {t.blockchainHash ? (
                                                    <span className="hash-tag" title={t.blockchainHash} style={{
                                                        background: '#f1f5f9',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem',
                                                        fontFamily: 'monospace',
                                                        color: '#475569',
                                                        display: 'inline-flex',
                                                        alignItems: 'center'
                                                    }}>
                                                        <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px', color: '#10b981' }} />
                                                        Verified
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8' }}>-</span>
                                                )}
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
                                ← Previous
                            </button>
                            <span className="pagination-info">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="pagination-btn"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default MyTransactions;
