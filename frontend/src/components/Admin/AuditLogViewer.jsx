import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, RefreshCw, Eye, Clock } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';

function AuditLogViewer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        action: '',
        suspicious: false,
        days: 7,
        page: 1,
        limit: 10
    });
    const [pagination, setPagination] = useState({});
    const [summary, setSummary] = useState({});
    const [, setSelectedLog] = useState(null);

    useEffect(() => {
        fetchAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/audit-logs', {
                params: {
                    page: filters.page,
                    limit: filters.limit,
                    days: filters.days,
                    ...(filters.action && { action: filters.action }),
                    ...(filters.suspicious && { suspicious: 'true' })
                }
            });

            const data = response.data;
            setLogs(data.logs);
            setPagination(data.pagination);
            setSummary(data.summary || {});
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'analyst_rate_limited': return <Clock size={16} />;
            case 'model_retrained': return <RefreshCw size={16} />;
            default: return <Eye size={16} />;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'analyst_rate_limited': return '#f59e0b';
            case 'model_retrained': return '#8b5cf6';
            default: return '#6b7280';
        }
    };

    const getRoleStyle = (role) => {
        switch (role) {
            case 'administrator': return { backgroundColor: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' };
            case 'barangay_official': return { backgroundColor: '#dbeafe', color: '#2563eb', border: '1px solid #bfdbfe' };
            case 'analyst': return { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' };
            case 'investigator': return { backgroundColor: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' };
            case 'resident': return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' };
            default: return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
        }
    };

    return (
        <div className="audit-log-viewer">
            <div className="admin-hero audit-hero">
                <div className="hero-text-section">
                    <div className="hero-label">INTEGRITY MONITORING WORKSPACE</div>
                    <h1 className="hero-title">Welcome back, Admin!</h1>
                    <p className="hero-description">
                        Monitor Philippine government financial transactions, detect anomaly patterns, and maintain transparent
                        audit trails using AI and blockchain technology.
                    </p>
                </div>

                <div className="hero-stats-row">
                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                            <AlertTriangle size={28} color="#ef4444" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{summary.suspiciousLast7Days || 0}</div>
                            <div className="hero-stat-label">SUSPICIOUS</div>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                            <Eye size={28} color="#3b82f6" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{pagination.total || 0}</div>
                            <div className="hero-stat-label">TOTAL LOGS</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="filters-section">
                <div className="filter-group">
                    <label>Action Type:</label>
                    <select
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                    >
                        <option value="">All Actions</option>
                        <option value="analyst_rate_limited">Rate Limited</option>
                        <option value="model_retrained">Model Retrained</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>Time Range:</label>
                    <select
                        value={filters.days}
                        onChange={(e) => setFilters({ ...filters, days: parseInt(e.target.value), page: 1 })}
                    >
                        <option value="1">Last 24 Hours</option>
                        <option value="7">Last 7 Days</option>
                        <option value="30">Last 30 Days</option>
                        <option value="90">Last 90 Days</option>
                    </select>
                </div>

                <div className="filter-group" style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        id="suspicious-filter"
                        checked={filters.suspicious}
                        onChange={(e) => setFilters({ ...filters, suspicious: e.target.checked, page: 1 })}
                    />
                    <label htmlFor="suspicious-filter" style={{ marginBottom: 0, cursor: 'pointer' }}>
                        Show Only Suspicious
                    </label>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading audit logs...</div>
            ) : (
                <>
                    <div className="logs-table">
                        {logs.length === 0 ? (
                            <div className="no-logs">No audit logs found</div>
                        ) : (
                            logs.map(log => (
                                <div
                                    key={log._id}
                                    className={`log-item ${log.isSuspicious ? 'suspicious' : ''}`}
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <div className="log-header">
                                        <div className="log-action" style={{ color: getActionColor(log.action) }}>
                                            {getActionIcon(log.action)}
                                            <span>{log.action.replace(/_/g, ' ').toUpperCase()}</span>
                                        </div>
                                        <div className="log-time">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="log-body">
                                        <div className="log-user">
                                            <strong>{log.user?.username || log.userId?.username || log.username || 'INTERNAL SYSTEM'}</strong>
                                            <span className="role-badge" style={getRoleStyle(log.userRole)}>{log.userRole?.replace(/_/g, ' ').toUpperCase() || 'SYSTEM'}</span>
                                        </div>

                                        {log.isSuspicious && (
                                            <div className="suspicious-badge">
                                                <AlertTriangle size={14} />
                                                {log.suspiciousReason}
                                            </div>
                                        )}

                                        {log.details && (
                                            <div className="log-details">
                                                {log.details.actualFraud !== undefined && (
                                                    <span>Decision: {log.details.actualFraud ? '❌ Irregular' : '✅ Regular'}</span>
                                                )}
                                                {log.details.confidence && (
                                                    <span>Confidence: {'⭐'.repeat(log.details.confidence)}</span>
                                                )}
                                                {log.details.predictedRisk && (
                                                    <span>AI Risk: {log.details.predictedRisk}</span>
                                                )}
                                                {/* Generic fallback for middleware logs */}
                                                {!log.details.actualFraud && !log.details.predictedRisk && (
                                                    <span className="generic-details">
                                                        {log.details.method} {log.details.url} {log.details.statusCode && `(${log.details.statusCode})`}
                                                        {typeof log.details === 'string' && log.details}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {pagination.pages > 1 && (
                        <div className="pagination">
                            <button
                                disabled={filters.page === 1}
                                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                            >
                                Previous
                            </button>
                            <span>Page {pagination.page} of {pagination.pages}</span>
                            <button
                                disabled={filters.page === pagination.pages}
                                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default AuditLogViewer;
