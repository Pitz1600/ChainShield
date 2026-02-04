import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Star, User, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import '../../styles/AdminPanel.css';

function FeedbackReview() {
    const [feedbackList, setFeedbackList] = useState([]);
    const [stats, setStats] = useState({
        pending: 0,
        approved: 0,
        rejected: 0,
        total: 0,
        currentModelAccuracy: null
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [rejectReason, setRejectReason] = useState('');

    useEffect(() => {
        fetchPendingFeedback();
        fetchStats();
    }, []);

    const fetchPendingFeedback = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/feedback/pending', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setFeedbackList(data.feedback || []);
            } else if (response.status === 403) {
                setError('You do not have permission to review feedback');
            } else {
                setError('Failed to load feedback');
            }
        } catch (err) {
            setError('Error loading feedback: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/feedback/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats({
                    pending: data.stats.pending || 0,
                    approved: data.stats.approved || 0,
                    rejected: data.stats.rejected || 0,
                    total: data.stats.total || 0,
                    currentModelAccuracy: data.stats.currentModelAccuracy
                });
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const handleApprove = async (feedbackId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/feedback/${feedbackId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();

                // Show success message
                alert(data.message);

                // Refresh data
                await fetchPendingFeedback();
                await fetchStats();
                setSelectedFeedback(null);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to approve feedback');
            }
        } catch (err) {
            alert('Error approving feedback: ' + err.message);
        }
    };

    const handleReject = async (feedbackId) => {
        if (!rejectReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/feedback/${feedbackId}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: rejectReason })
            });

            if (response.ok) {
                const data = await response.json();
                alert(data.message);

                // Refresh data
                await fetchPendingFeedback();
                await fetchStats();
                setSelectedFeedback(null);
                setRejectReason('');
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to reject feedback');
            }
        } catch (err) {
            alert('Error rejecting feedback: ' + err.message);
        }
    };

    const getRiskLevelColor = (score) => {
        if (score >= 70) return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' };
        if (score >= 40) return { bg: '#fffbeb', color: '#92400e', border: '#fde68a' };
        return { bg: '#f0fdf4', color: '#065f46', border: '#bbf7d0' };
    };

    const getRiskLevelText = (score) => {
        if (score >= 70) return 'HIGH';
        if (score >= 40) return 'MEDIUM';
        return 'LOW';
    };

    const accuracy = stats.currentModelAccuracy?.accuracy
        ? (stats.currentModelAccuracy.accuracy * 100).toFixed(1)
        : '87.0';

    return (
        <div className="admin-panel">
            <div className="page-hero admin-hero">
                <div>
                    <span className="hero-tag">FEEDBACK REVIEW</span>
                    <h2 className="hero-title">AI Learning Management</h2>
                    <p className="hero-subtitle">Review analyst feedback to improve AI accuracy and prevent model poisoning.</p>
                </div>
                <div className="hero-stats">
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{stats.pending}</span>
                        <span className="hero-stat-label">Pending</span>
                    </div>
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{stats.approved}</span>
                        <span className="hero-stat-label">Approved</span>
                    </div>
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{accuracy}%</span>
                        <span className="hero-stat-label">Accuracy</span>
                    </div>
                </div>
            </div>

            <div className="admin-content-wrapper">
                <div className="admin-content">
                    {loading && (
                        <div style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                            <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading feedback...</p>
                        </div>
                    )}

                    {error && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                            {error}
                        </div>
                    )}

                    {!loading && !error && (
                        <>
                            {/* Progress Bar */}
                            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#475569' }}>
                                        Training Progress
                                    </span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#3b82f6' }}>
                                        {stats.approved}/100 samples
                                    </span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min((stats.approved / 100) * 100, 100)}%`,
                                        height: '100%',
                                        background: stats.approved >= 100 ? '#10b981' : '#3b82f6',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '99px'
                                    }}></div>
                                </div>
                                {stats.approved >= 100 && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#d1fae5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <CheckCircle size={18} color="#059669" />
                                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#059669' }}>
                                            Ready to retrain! Model will update automatically.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Feedback List */}
                            <div className="users-table-container">
                                <h3 style={{ margin: '0 0 1.5rem', color: '#334155', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Clock size={24} className="text-blue-500" />
                                    Pending Feedback ({feedbackList.length})
                                </h3>

                                {feedbackList.length === 0 ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                        <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>All caught up!</p>
                                        <p style={{ fontSize: '0.875rem' }}>No pending feedback to review.</p>
                                    </div>
                                ) : (
                                    feedbackList.map((feedback) => {
                                        const riskStyle = getRiskLevelColor(feedback.predictedRisk);
                                        const isExpanded = selectedFeedback?._id === feedback._id;

                                        return (
                                            <div key={feedback._id} style={{
                                                marginBottom: '1rem',
                                                border: '1px solid #e2e8f0',
                                                borderRadius: '12px',
                                                overflow: 'hidden',
                                                background: '#fff'
                                            }}>
                                                {/* Feedback Header */}
                                                <div
                                                    style={{
                                                        padding: '1.25rem',
                                                        cursor: 'pointer',
                                                        background: isExpanded ? '#f8fafc' : '#fff',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onClick={() => setSelectedFeedback(isExpanded ? null : feedback)}
                                                >
                                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr auto', gap: '1rem', alignItems: 'center' }}>
                                                        {/* Transaction Info */}
                                                        <div>
                                                            <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.25rem' }}>
                                                                Transaction #{feedback.transactionId?._id?.slice(-6) || 'N/A'}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                                ₱{feedback.transactionId?.amount?.toLocaleString() || 'N/A'}
                                                            </div>
                                                        </div>

                                                        {/* AI Prediction */}
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>AI Predicted</div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                padding: '0.25rem 0.75rem',
                                                                borderRadius: '99px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700',
                                                                background: riskStyle.bg,
                                                                color: riskStyle.color,
                                                                border: `1px solid ${riskStyle.border}`
                                                            }}>
                                                                {getRiskLevelText(feedback.predictedRisk)} ({feedback.predictedRisk})
                                                            </span>
                                                        </div>

                                                        {/* Analyst Decision */}
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Analyst Says</div>
                                                            <span style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '0.25rem',
                                                                padding: '0.25rem 0.75rem',
                                                                borderRadius: '99px',
                                                                fontSize: '0.75rem',
                                                                fontWeight: '700',
                                                                background: feedback.actualFraud ? '#fef2f2' : '#f0fdf4',
                                                                color: feedback.actualFraud ? '#991b1b' : '#065f46',
                                                                border: feedback.actualFraud ? '1px solid #fecaca' : '1px solid #bbf7d0'
                                                            }}>
                                                                {feedback.actualFraud ? 'FRAUD' : 'NOT FRAUD'}
                                                            </span>
                                                        </div>

                                                        {/* Confidence */}
                                                        <div style={{ display: 'flex', gap: '2px' }}>
                                                            {[1, 2, 3, 4, 5].map(i => (
                                                                <Star
                                                                    key={i}
                                                                    size={16}
                                                                    fill={i <= feedback.confidence ? '#fbbf24' : 'none'}
                                                                    color={i <= feedback.confidence ? '#fbbf24' : '#cbd5e1'}
                                                                />
                                                            ))}
                                                        </div>

                                                        {/* Expand Icon */}
                                                        <div style={{ color: '#64748b' }}>
                                                            {isExpanded ? '▼' : '▶'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Details */}
                                                {isExpanded && (
                                                    <div style={{ padding: '1.25rem', borderTop: '1px solid #e2e8f0', background: '#fafafa' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                                            {/* Left Column */}
                                                            <div>
                                                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '1rem' }}>
                                                                    Transaction Details
                                                                </h4>
                                                                <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Amount:</span>
                                                                        <span style={{ fontWeight: '600', color: '#334155' }}>
                                                                            ₱{feedback.transactionId?.amount?.toLocaleString() || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Type:</span>
                                                                        <span style={{ fontWeight: '600', color: '#334155' }}>
                                                                            {feedback.transactionId?.transactionType || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Model:</span>
                                                                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#334155' }}>
                                                                            {feedback.modelVersion}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Right Column */}
                                                            <div>
                                                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '1rem' }}>
                                                                    Analyst Information
                                                                </h4>
                                                                <div style={{ fontSize: '0.875rem', lineHeight: '1.8' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Analyst:</span>
                                                                        <span style={{ fontWeight: '600', color: '#334155' }}>
                                                                            {feedback.analystId?.username || 'Unknown'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Role:</span>
                                                                        <span style={{ fontWeight: '600', color: '#334155' }}>
                                                                            {feedback.analystRole || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span style={{ color: '#64748b' }}>Submitted:</span>
                                                                        <span style={{ fontSize: '0.8rem', color: '#334155' }}>
                                                                            {new Date(feedback.reviewDate).toLocaleString()}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Notes */}
                                                        {feedback.notes && (
                                                            <div style={{ marginBottom: '1.5rem' }}>
                                                                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>
                                                                    Analyst Notes
                                                                </h4>
                                                                <div style={{
                                                                    padding: '0.75rem',
                                                                    background: '#fff',
                                                                    borderRadius: '8px',
                                                                    fontSize: '0.875rem',
                                                                    color: '#475569',
                                                                    border: '1px solid #e2e8f0',
                                                                    fontStyle: 'italic'
                                                                }}>
                                                                    "{feedback.notes}"
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Reject Reason Input */}
                                                        <div style={{ marginBottom: '1rem' }}>
                                                            <label style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem', display: 'block' }}>
                                                                Rejection Reason (if rejecting)
                                                            </label>
                                                            <textarea
                                                                value={rejectReason}
                                                                onChange={(e) => setRejectReason(e.target.value)}
                                                                placeholder="Provide a reason for rejection..."
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '0.75rem',
                                                                    borderRadius: '8px',
                                                                    border: '1px solid #e2e8f0',
                                                                    fontSize: '0.875rem',
                                                                    fontFamily: 'inherit',
                                                                    resize: 'vertical',
                                                                    minHeight: '80px'
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                                            <button
                                                                onClick={() => handleReject(feedback._id)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem',
                                                                    padding: '0.75rem 1.5rem',
                                                                    background: '#fff',
                                                                    border: '2px solid #ef4444',
                                                                    borderRadius: '8px',
                                                                    color: '#ef4444',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.875rem',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => {
                                                                    e.target.style.background = '#ef4444';
                                                                    e.target.style.color = '#fff';
                                                                }}
                                                                onMouseOut={(e) => {
                                                                    e.target.style.background = '#fff';
                                                                    e.target.style.color = '#ef4444';
                                                                }}
                                                            >
                                                                <XCircle size={18} />
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => handleApprove(feedback._id)}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem',
                                                                    padding: '0.75rem 1.5rem',
                                                                    background: '#10b981',
                                                                    border: '2px solid #10b981',
                                                                    borderRadius: '8px',
                                                                    color: '#fff',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.875rem',
                                                                    cursor: 'pointer',
                                                                    transition: 'all 0.2s'
                                                                }}
                                                                onMouseOver={(e) => {
                                                                    e.target.style.background = '#059669';
                                                                    e.target.style.borderColor = '#059669';
                                                                }}
                                                                onMouseOut={(e) => {
                                                                    e.target.style.background = '#10b981';
                                                                    e.target.style.borderColor = '#10b981';
                                                                }}
                                                            >
                                                                <CheckCircle size={18} />
                                                                Approve
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default FeedbackReview;
