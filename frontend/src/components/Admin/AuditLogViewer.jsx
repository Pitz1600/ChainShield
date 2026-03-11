import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Eye, Clock, X } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';

function AuditLogViewer() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [presence, setPresence] = useState([]);
    const [filters, setFilters] = useState({
        action: '',
        suspicious: false,
        days: 7,
        page: 1,
        limit: 10
    });
    const [pagination, setPagination] = useState({});
    const [summary, setSummary] = useState({});
    const [selectedLog, setSelectedLog] = useState(null);
    const [sessionFilter, setSessionFilter] = useState('all');

    useEffect(() => {
        fetchAuditLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters]);

    const fetchAuditLogs = async () => {
        setLoading(true);
        setError('');
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

            const data = response.data || {};
            setLogs(Array.isArray(data.logs) ? data.logs : []);
            setPagination(data.pagination || {});
            setSummary(data.summary || {});
            setPresence(Array.isArray(data.presence) ? data.presence : []);
        } catch (err) {
            console.error('Error fetching audit logs:', err);
            setError(err?.response?.data?.error || 'Failed to load audit logs.');
        } finally {
            setLoading(false);
        }
    };

    const formatAction = (action) => String(action || 'unknown_action').replace(/_/g, ' ').toUpperCase();

    const formatTimeAgo = (dateValue) => {
        if (!dateValue) return 'Never active';
        const ms = Date.now() - new Date(dateValue).getTime();
        if (ms < 60 * 1000) return 'Online now';
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'analyst_rate_limited': return <Clock size={16} />;
            case 'model_retrained': return <RefreshCw size={16} />;
            case 'suspicious_login':
            case 'login_failed': return <AlertTriangle size={16} />;
            default: return <Eye size={16} />;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'analyst_rate_limited': return '#f59e0b';
            case 'model_retrained': return '#8b5cf6';
            case 'suspicious_login':
            case 'login_failed': return '#ef4444';
            case 'user_login':
            case 'user_login_otp': return '#10b981';
            case 'user_logout': return '#64748b';
            default: return '#6b7280';
        }
    };

    const getRoleStyle = (role) => {
        switch (role) {
            case 'administrator': return { backgroundColor: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' };
            case 'barangay_official': return { backgroundColor: '#dbeafe', color: '#2563eb', border: '1px solid #bfdbfe' };
            case 'auditor': return { backgroundColor: '#ecfeff', color: '#0e7490', border: '1px solid #a5f3fc' };
            case 'resident': return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' };
            default: return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
        }
    };

    const getRiskMeter = (log) => {
        const rawRisk = log?.details?.predictedRisk;

        if (typeof rawRisk === 'number') {
            const normalized = Math.max(0, Math.min(100, rawRisk));
            if (normalized >= 70) return { label: 'High', score: normalized, color: '#dc2626', track: '#fee2e2' };
            if (normalized >= 41) return { label: 'Medium', score: normalized, color: '#d97706', track: '#fef3c7' };
            return { label: 'Low', score: normalized, color: '#059669', track: '#d1fae5' };
        }

        const mapped = String(rawRisk || '').toLowerCase();
        if (mapped.includes('high')) return { label: 'High', score: 85, color: '#dc2626', track: '#fee2e2' };
        if (mapped.includes('medium')) return { label: 'Medium', score: 55, color: '#d97706', track: '#fef3c7' };
        return { label: 'Low', score: 25, color: '#059669', track: '#d1fae5' };
    };

    const actionOptions = useMemo(() => {
        const arr = Array.isArray(summary?.actionCounts) ? summary.actionCounts : [];
        return arr.map((a) => ({ value: a._id, label: `${formatAction(a._id)} (${a.count})` }));
    }, [summary]);

    const filteredPresence = useMemo(() => {
        if (!Array.isArray(presence)) return [];
        if (sessionFilter === 'online') return presence.filter((p) => p.isOnline);
        if (sessionFilter === 'offline') return presence.filter((p) => !p.isOnline);
        return presence;
    }, [presence, sessionFilter]);

    return (
        <div className="audit-log-viewer">
            <div className="admin-hero audit-hero">
                <div className="hero-text-section">
                    <div className="hero-label">AUDIT MONITORING WORKSPACE</div>
                    <h1 className="hero-title">System Activity & Session Audit</h1>
                    <p className="hero-description">
                        Track security events, user actions, and account presence with online status and last seen activity.
                    </p>
                </div>

                <div className="hero-stats-row">
                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                            <AlertTriangle size={28} color="#ef4444" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{summary.suspiciousLast7Days || 0}</div>
                            <div className="hero-stat-label">SUSPICIOUS (7D)</div>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                            <Eye size={28} color="#10b981" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{summary.onlineCount || 0}</div>
                            <div className="hero-stat-label">ONLINE USERS</div>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)' }}>
                            <Clock size={28} color="#3b82f6" />
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
                        {actionOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-group">
                    <label>Time Range:</label>
                    <select
                        value={filters.days}
                        onChange={(e) => setFilters({ ...filters, days: parseInt(e.target.value, 10), page: 1 })}
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

                <div className="filter-group">
                    <label>User Sessions:</label>
                    <select
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                    >
                        <option value="all">All</option>
                        <option value="online">Online Only</option>
                        <option value="offline">Offline Only</option>
                    </select>
                </div>
            </div>

            {error && (
                <div className="no-logs" style={{ marginBottom: '1rem', color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}>
                    {error}
                </div>
            )}

            {presence.length > 0 && (
                <div className="logs-table" style={{ marginBottom: '1.25rem' }}>
                    <div className="log-item" style={{ cursor: 'default' }}>
                        <div className="log-header" style={{ marginBottom: '0.75rem' }}>
                            <div className="log-action"><Eye size={16} /> <span>Current User Presence</span></div>
                            <div className="log-time">{summary.onlineCount || 0} online / {summary.offlineCount || 0} offline</div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '0.75rem' }}>
                            {filteredPresence.map((p) => (
                                <div key={p.userId} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.7rem 0.8rem', background: p.isOnline ? '#ecfdf5' : '#f8fafc' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{p.username}</strong>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: p.isOnline ? '#047857' : '#64748b' }}>
                                            {p.isOnline ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                    <div style={{ marginTop: '0.3rem', color: '#475569', fontSize: '0.8rem' }}>{String(p.role || 'resident').replace(/_/g, ' ')}</div>
                                    <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.8rem' }}>Last seen: {formatTimeAgo(p.lastSeenAt)}</div>
                                </div>
                            ))}
                        </div>
                        {filteredPresence.length === 0 && (
                            <div className="no-logs" style={{ marginTop: '0.75rem' }}>No users match the selected session filter.</div>
                        )}
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading">Loading audit logs...</div>
            ) : (
                <>
                    <div className="logs-table">
                        {logs.length === 0 ? (
                            <div className="no-logs">No audit logs found</div>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log._id}
                                    className={`log-item ${log.isSuspicious ? 'suspicious' : ''}`}
                                    onClick={() => setSelectedLog(log)}
                                >
                                    <div className="log-header">
                                        <div className="log-action" style={{ color: getActionColor(log.action) }}>
                                            {getActionIcon(log.action)}
                                            <span>{formatAction(log.action)}</span>
                                        </div>
                                        <div className="log-time">
                                            {new Date(log.createdAt).toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="log-body">
                                        <div className="log-user" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <strong>{log.user?.username || log.username || 'INTERNAL SYSTEM'}</strong>
                                                <span className="role-badge" style={getRoleStyle(log.user?.role || log.userRole)}>{String(log.user?.role || log.userRole || 'system').replace(/_/g, ' ').toUpperCase()}</span>
                                            </div>
                                            {log.userPresence && (
                                                <span style={{ fontSize: '0.8rem', color: log.userPresence.isOnline ? '#059669' : '#64748b', fontWeight: 700 }}>
                                                    {log.userPresence.isOnline ? 'ONLINE NOW' : `LAST SEEN ${formatTimeAgo(log.userPresence.lastSeenAt).toUpperCase()}`}
                                                </span>
                                            )}
                                        </div>

                                        {log.isSuspicious && (
                                            <div className="suspicious-badge">
                                                <AlertTriangle size={14} />
                                                {log.suspiciousReason || 'Suspicious activity detected'}
                                            </div>
                                        )}

                                        {log.details && typeof log.details === 'object' && (
                                            <div className="log-details">
                                                {log.details.actualFraud !== undefined && (
                                                    <span>Decision: {log.details.actualFraud ? 'Irregular' : 'Regular'}</span>
                                                )}
                                                {log.details.confidence !== undefined && (
                                                    <span>Confidence: {log.details.confidence}/5</span>
                                                )}
                                                {log.details.predictedRisk !== undefined && (
                                                    <span>AI Risk: {String(log.details.predictedRisk)}</span>
                                                )}
                                                {log.details.method && <span>Method: {log.details.method}</span>}
                                                {log.details.url && <span>URL: {log.details.url}</span>}
                                                {log.details.statusCode && <span>Status: {log.details.statusCode}</span>}
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

                    {selectedLog && (
                        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
                            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3>Audit Log Details</h3>
                                    <button
                                        type="button"
                                        className="close-modal-btn"
                                        aria-label="Close audit details"
                                        onClick={() => setSelectedLog(null)}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="modal-body">
                                    {(() => {
                                        const meter = getRiskMeter(selectedLog);
                                        return (
                                            <div
                                                style={{
                                                    marginBottom: '1rem',
                                                    padding: '0.9rem 1rem',
                                                    borderRadius: '12px',
                                                    border: `1px solid ${meter.color}33`,
                                                    background: meter.track
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        marginBottom: '0.5rem',
                                                        fontWeight: 700,
                                                        color: '#0f172a'
                                                    }}
                                                >
                                                    <span>Live Risk Meter</span>
                                                    <span style={{ color: meter.color }}>{meter.label} ({meter.score}%)</span>
                                                </div>
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        height: '10px',
                                                        borderRadius: '9999px',
                                                        overflow: 'hidden',
                                                        background: '#e2e8f0'
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            width: `${meter.score}%`,
                                                            height: '100%',
                                                            background: meter.color
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div style={{ display: 'grid', gap: '0.9rem' }}>
                                        <div><strong>Action:</strong> {formatAction(selectedLog.action)}</div>
                                        <div><strong>User:</strong> {selectedLog.user?.username || selectedLog.username || 'INTERNAL SYSTEM'}</div>
                                        <div><strong>Role:</strong> {String(selectedLog.user?.role || selectedLog.userRole || 'system').replace(/_/g, ' ').toUpperCase()}</div>
                                        <div><strong>Timestamp:</strong> {new Date(selectedLog.createdAt).toLocaleString()}</div>
                                        {selectedLog.userPresence && (
                                            <div><strong>Presence:</strong> {selectedLog.userPresence.isOnline ? 'Online now' : `Offline (last seen ${formatTimeAgo(selectedLog.userPresence.lastSeenAt)})`}</div>
                                        )}
                                        <div><strong>Suspicious:</strong> {selectedLog.isSuspicious ? 'Yes' : 'No'}</div>
                                        {selectedLog.suspiciousReason && (
                                            <div><strong>Reason:</strong> {selectedLog.suspiciousReason}</div>
                                        )}
                                        <div>
                                            <strong>Details:</strong>
                                            <pre
                                                style={{
                                                    marginTop: '0.5rem',
                                                    padding: '0.75rem',
                                                    background: '#f8fafc',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '10px',
                                                    overflowX: 'auto',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word'
                                                }}
                                            >
                                                {JSON.stringify(selectedLog.details || {}, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default AuditLogViewer;
