import React, { useState, useEffect } from 'react';
import { FileText, AlertTriangle, Flag, RefreshCw, Filter, Eye, XCircle, CheckCircle, Clock } from 'lucide-react';
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
    const [selectedLog, setSelectedLog] = useState(null);
    const [flagModalOpen, setFlagModalOpen] = useState(false);
    const [flagReason, setFlagReason] = useState('');

    useEffect(() => {
        fetchAuditLogs();
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

    const handleFlagFeedback = async (feedbackId) => {
        if (!flagReason.trim()) {
            alert('Please provide a reason for flagging this feedback');
            return;
        }

        try {
            await api.post(`/feedback/${feedbackId}/flag`, { reason: flagReason });
            alert('✅ Feedback flagged and removed from training dataset');
            setFlagModalOpen(false);
            setFlagReason('');
            setSelectedLog(null);
            fetchAuditLogs();
        } catch (error) {
            console.error('Error flagging feedback:', error);
            alert('Error: ' + (error.response?.data?.error || 'Error flagging feedback'));
        }
    };

    const getActionIcon = (action) => {
        switch (action) {
            case 'feedback_submitted': return <FileText size={16} />;
            case 'feedback_auto_approved': return <CheckCircle size={16} />;
            case 'feedback_flagged': return <Flag size={16} />;
            case 'analyst_rate_limited': return <Clock size={16} />;
            case 'model_retrained': return <RefreshCw size={16} />;
            default: return <Eye size={16} />;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'feedback_submitted': return '#3b82f6';
            case 'feedback_auto_approved': return '#10b981';
            case 'feedback_flagged': return '#ef4444';
            case 'analyst_rate_limited': return '#f59e0b';
            case 'model_retrained': return '#8b5cf6';
            default: return '#6b7280';
        }
    };

    const getRoleStyle = (role) => {
        switch (role) {
            case 'administrator': return { backgroundColor: '#ede9fe', color: '#7c3aed', border: '1px solid #ddd6fe' }; // Purple
            case 'barangay_official': return { backgroundColor: '#dbeafe', color: '#2563eb', border: '1px solid #bfdbfe' }; // Blue
            case 'analyst': return { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }; // Amber
            case 'investigator': return { backgroundColor: '#ccfbf1', color: '#0f766e', border: '1px solid #99f6e4' }; // Teal
            case 'resident': return { backgroundColor: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb' }; // Gray
            default: return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
        }
    };

    return (
        <div className="audit-log-viewer">
            {/* Hero Section - Matching Reference Design */}
            <div className="admin-hero audit-hero">
                <div className="hero-text-section">
                    <div className="hero-label">INTEGRITY MONITORING WORKSPACE</div>
                    <h1 className="hero-title">Welcome back, Admin!</h1>
                    <p className="hero-description">
                        Monitor Philippine government financial transactions, detect anomaly patterns, and maintain transparent
                        audit trails using AI and blockchain technology.
                    </p>
                </div>

                {/* Glassmorphic Stats Row */}
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
                        <div className="hero-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                            <Flag size={28} color="#ef4444" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{logs.filter(l => l.action === 'feedback_flagged').length}</div>
                            <div className="hero-stat-label">FLAGGED</div>
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

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle size={28} color="#10b981" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">{logs.filter(l => l.action === 'feedback_auto_approved').length}</div>
                            <div className="hero-stat-label">AUTO-APPROVED</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filters-section">
                <div className="filter-group">
                    <label>Action Type:</label>
                    <select
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
                    >
                        <option value="">All Actions</option>
                        <option value="feedback_submitted">Feedback Submitted</option>
                        <option value="feedback_auto_approved">Auto Approved</option>
                        <option value="feedback_flagged">Flagged</option>
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

            {/* Logs Table */}
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
                                            <strong>{log.userId?.username || log.username || 'Unknown'}</strong>
                                            <span className="role-badge" style={getRoleStyle(log.userRole)}>{log.userRole?.replace(/_/g, ' ').toUpperCase()}</span>
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
                                            </div>
                                        )}
                                    </div>

                                    {log.isSuspicious && log.feedbackId && (
                                        <div className="log-actions">
                                            <button
                                                className="flag-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLog(log);
                                                    setFlagModalOpen(true);
                                                }}
                                            >
                                                <Flag size={14} />
                                                Flag as Malicious
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Pagination */}
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

            {/* Flag Modal */}
            {flagModalOpen && selectedLog && (
                <div className="modal-overlay" onClick={() => setFlagModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Flag Malicious Feedback</h3>
                            <button className="close-btn" onClick={() => setFlagModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p><strong>User:</strong> {selectedLog.userId?.username}</p>
                            <p><strong>Suspicious Reason:</strong> {selectedLog.suspiciousReason}</p>

                            <label>Reason for Flagging:</label>
                            <textarea
                                value={flagReason}
                                onChange={(e) => setFlagReason(e.target.value)}
                                placeholder="Explain why this feedback is malicious..."
                                rows={4}
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setFlagModalOpen(false)}>
                                Cancel
                            </button>
                            <button
                                className="flag-confirm-btn"
                                onClick={() => handleFlagFeedback(selectedLog.feedbackId)}
                            >
                                <Flag size={16} />
                                Flag & Remove from Training
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AuditLogViewer;
