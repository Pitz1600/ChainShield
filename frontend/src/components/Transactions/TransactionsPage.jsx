import React, { useState, useEffect } from 'react';
import { AlertTriangle, List, FileText, Upload, CheckCircle, Clock } from 'lucide-react';
import api from '../../services/api';
import AlertsManagement from '../Alerts/AlertsManagement';
import MyTransactions from './MyTransactions';
import ResidentTransactions from './ResidentTransactions';
import '../../styles/TransactionsPage.css';

function TransactionsPage({ user }) {
    const role        = user?.role;
    const isResident  = role === 'resident';
    const isOfficial  = role === 'barangay_official';
    const isAuditor   = role === 'auditor';
    const isAdmin     = role === 'administrator';

    const defaultTab  = isAuditor ? 'alerts' : isOfficial ? 'ledger' : isAdmin ? 'alerts' : 'ledger';
    const [activeTab, setActiveTab] = useState(defaultTab);

    const [alertCount,    setAlertCount]    = useState(0);
    const [criticalCount, setCriticalCount] = useState(0);
    const [highCount,     setHighCount]     = useState(0);
    const [mediumCount,   setMediumCount]   = useState(0);
    const [historyCount,  setHistoryCount]  = useState(0);
    const [resolvedCount, setResolvedCount] = useState(0);

    // Staged records pending public release
    const [stagedCount,  setStagedCount]  = useState(0);
    const [approving,    setApproving]    = useState(false);
    const [approveMsg,   setApproveMsg]   = useState('');
    const [txRefreshKey, setTxRefreshKey] = useState(0);

    useEffect(() => { fetchCounts(); }, []);

    const fetchCounts = async () => {
        try {
            const alertsResponse = await api.get('/transactions/alerts?limit=5000');
            const allAlerts = alertsResponse.data.alerts || [];
            setAlertCount(allAlerts.filter(a => a.status !== 'resolved').length);
            setCriticalCount(allAlerts.filter(a => Number(a.riskScore || 0) >= 90).length);
            setHighCount(allAlerts.filter(a => Number(a.riskScore || 0) >= 71 && Number(a.riskScore || 0) < 90).length);
            setMediumCount(allAlerts.filter(a => Number(a.riskScore || 0) >= 41 && Number(a.riskScore || 0) < 71).length);
            setResolvedCount(allAlerts.filter(a => a.status === 'resolved').length);

            const historyResponse = await api.get('/transactions/my-transactions', {
                params: { limit: 1, page: 1, includeStaged: isAdmin || isOfficial || isResident }
            });
            setHistoryCount(historyResponse.data.count || 0);

            // For residents: get verified and under-review counts from my-transactions
            // so all three hero numbers use the same data source and visibility rules
            if (isResident) {
                const [verifiedRes, underReviewRes] = await Promise.all([
                    api.get('/transactions/my-transactions', { params: { limit: 1, page: 1, status: 'Verified,Pending', includeStaged: true } }),
                    api.get('/transactions/my-transactions', { params: { limit: 1, page: 1, status: 'Flagged,Suspicious', includeStaged: true } }),
                ]);
                // Patch alertCount for resident hero "Under Review" to use real tx count
                setAlertCount(underReviewRes.data.count || 0);
                setResolvedCount(verifiedRes.data.count || 0);
            }

            // Count staged-only records so we can warn the admin
            if (isAdmin || isOfficial) {
                const stagedRes = await api.get('/transactions/my-transactions', {
                    params: { limit: 500, includeStaged: true }
                });
                const stagedTxns = (stagedRes.data.transactions || []).filter(t => t.staged);
                setStagedCount(stagedTxns.length);
            }
        } catch (error) {
            console.error('Error fetching counts:', error);
        }
    };

    // Publish all staged transactions so residents can see them
    const handlePublishAll = async () => {
        if (approving) return;
        setApproving(true);
        setApproveMsg('');
        try {
            const res = await api.get('/transactions/my-transactions', {
                params: { limit: 500, includeStaged: true }
            });
            const stagedIds = (res.data.transactions || [])
                .filter(t => t.staged)
                .map(t => t._id);

            if (stagedIds.length === 0) {
                setApproveMsg('No pending records found.');
                setApproving(false);
                return;
            }

            await api.put('/transactions/batch-action', { ids: stagedIds, action: 'approve' });

            setStagedCount(0);
            setApproveMsg(`✓ ${stagedIds.length} transactions are now publicly visible to residents.`);
            setTxRefreshKey(k => k + 1);
            fetchCounts();
        } catch (err) {
            console.error('Publish error:', err);
            setApproveMsg('Failed to publish. Please try again.');
        } finally {
            setApproving(false);
        }
    };

    // ── Hero copy per role ───────────────────────────────────────────
    const heroConfig = {
        resident: {
            label: 'PUBLIC SPENDING RECORDS',
            title: 'Barangay Budget Transactions',
            desc:  'View all public spending records for Barangay Pantal. Click any transaction to see details or report a concern.',
        },
        barangay_official: {
            label: 'BARANGAY OFFICIAL — TRANSACTION RECORDS',
            title: 'Manage Your Submitted Transactions',
            desc:  'Upload new transaction CSVs, track the status of your submissions, and verify records on the blockchain.',
        },
        auditor: {
            label: 'AUDITOR — TRANSACTION REVIEW',
            title: 'Review & Investigate Flagged Transactions',
            desc:  'Monitor AI-flagged alerts, review risk scores, and escalate suspicious transactions for administrator action.',
        },
        administrator: {
            label: 'ADMIN — TRANSACTION MANAGEMENT',
            title: 'Monitor Blockchain Transactions',
            desc:  'Track high-risk alerts flagged by AI, approve or deny submissions, and manage the full transaction ledger.',
        },
    };
    const hero = heroConfig[role] || heroConfig.administrator;

    return (
        <div className="transactions-page">
            {/* Hero Section */}
            <div className="admin-hero transactions-hero">
                <div className="hero-text-section">
                    <div className="hero-label">{hero.label}</div>
                    <h1 className="hero-title">{hero.title}</h1>
                    <p className="hero-description">{hero.desc}</p>
                </div>

                {/* Stats Row */}
                <div className="hero-stats-row">
                    {isResident && (
                        <>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                                    <FileText size={28} color="#3b82f6" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{historyCount}</div>
                                    <div className="hero-stat-label">TOTAL TRANSACTIONS</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                    <FileText size={28} color="#10b981" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{resolvedCount}</div>
                                    <div className="hero-stat-label">APPROVED</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(249,115,22,0.15)' }}>
                                    <AlertTriangle size={28} color="#f97316" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{alertCount}</div>
                                    <div className="hero-stat-label">UNDER REVIEW</div>
                                </div>
                            </div>
                        </>
                    )}

                    {isOfficial && (
                        <>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>
                                    <FileText size={28} color="#3b82f6" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{historyCount}</div>
                                    <div className="hero-stat-label">SUBMITTED</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                    <FileText size={28} color="#10b981" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{resolvedCount}</div>
                                    <div className="hero-stat-label">APPROVED</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(249,115,22,0.15)' }}>
                                    <AlertTriangle size={28} color="#f97316" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{alertCount}</div>
                                    <div className="hero-stat-label">FLAGGED</div>
                                </div>
                            </div>
                        </>
                    )}

                    {isAuditor && (
                        <>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{alertCount}</div>
                                    <div className="hero-stat-label">OPEN ALERTS</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239,68,68,0.2)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{criticalCount}</div>
                                    <div className="hero-stat-label">CRITICAL</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                    <FileText size={28} color="#10b981" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{resolvedCount}</div>
                                    <div className="hero-stat-label">RESOLVED</div>
                                </div>
                            </div>
                        </>
                    )}

                    {isAdmin && (
                        <>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239,68,68,0.2)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{alertCount}</div>
                                    <div className="hero-stat-label">TOTAL ALERTS</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239,68,68,0.2)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{criticalCount}</div>
                                    <div className="hero-stat-label">CRITICAL</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(249,115,22,0.2)' }}>
                                    <AlertTriangle size={28} color="#f97316" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{highCount}</div>
                                    <div className="hero-stat-label">HIGH RISK</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(34,197,94,0.2)' }}>
                                    <FileText size={28} color="#22c55e" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{mediumCount}</div>
                                    <div className="hero-stat-label">MEDIUM RISK</div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── STAGED RECORDS BANNER ── */}
            {(isAdmin || isOfficial) && stagedCount > 0 && (
                <div style={{
                    margin: '0 0 16px',
                    padding: '14px 20px',
                    background: '#fffbeb',
                    border: '1.5px solid #fcd34d',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Clock size={18} color="#d97706" />
                        <div>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#92400e' }}>
                                {stagedCount} imported transaction{stagedCount !== 1 ? 's' : ''} not yet visible to residents
                            </div>
                            <div style={{ fontSize: '0.76rem', color: '#b45309', marginTop: 2 }}>
                                These records were processed by the AI pipeline but are awaiting official publication. Residents cannot see them until you publish.
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handlePublishAll}
                        disabled={approving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '9px 18px',
                            background: approving ? '#d1d5db' : '#16a34a',
                            color: '#fff', border: 'none', borderRadius: 8,
                            cursor: approving ? 'not-allowed' : 'pointer',
                            fontWeight: 600, fontSize: '0.84rem', whiteSpace: 'nowrap',
                        }}
                    >
                        <CheckCircle size={15} />
                        {approving ? 'Publishing...' : `Publish All ${stagedCount} Records`}
                    </button>
                </div>
            )}

            {/* Success / error message after publish */}
            {approveMsg && (
                <div style={{
                    margin: '0 0 16px', padding: '12px 18px',
                    background: approveMsg.startsWith('✓') ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${approveMsg.startsWith('✓') ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 10, fontSize: '0.85rem',
                    color: approveMsg.startsWith('✓') ? '#166534' : '#991b1b',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    {approveMsg.startsWith('✓') ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                    {approveMsg}
                </div>
            )}

            {/* Tabs */}
            {!isResident && (
                <div className="transactions-tabs">
                    {(isAdmin || isAuditor) && (
                        <button
                            className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
                            onClick={() => setActiveTab('alerts')}
                        >
                            <AlertTriangle size={18} />
                            <span>{isAuditor ? 'Alerts to Review' : 'Alerts'}</span>
                            {alertCount > 0 && <span className="tab-badge">{alertCount}</span>}
                        </button>
                    )}
                    <button
                        className={`tab-button ${activeTab === 'ledger' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ledger')}
                    >
                        <List size={18} />
                        <span>{isOfficial ? 'My Submissions' : 'All Transactions'}</span>
                        {historyCount > 0 && <span className="tab-badge">{historyCount}</span>}
                    </button>
                    {isOfficial && (
                        <button
                            className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
                            onClick={() => setActiveTab('upload')}
                        >
                            <Upload size={18} />
                            <span>Upload CSV</span>
                        </button>
                    )}
                </div>
            )}

            {/* Content */}
            <div className="tab-content">
                {isResident ? (
                    <ResidentTransactions user={user} embedded={true} />
                ) : activeTab === 'alerts' ? (
                    <AlertsManagement embedded={true} user={user} />
                ) : activeTab === 'upload' ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ maxWidth: 480, margin: '0 auto', background: '#f8fafc', border: '0.5px solid #e2e8f0', borderRadius: 12, padding: '2rem' }}>
                            <Upload size={40} color="#3b82f6" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>Upload Transaction CSV</h3>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                                Import your barangay transaction records. The AI pipeline will automatically analyze each transaction for anomalies.
                            </p>
                            <button
                                onClick={() => setActiveTab('ledger')}
                                style={{ padding: '0.6rem 1.5rem', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
                            >
                                Go to Transactions &amp; Upload
                            </button>
                        </div>
                    </div>
                ) : (
                    <MyTransactions key={txRefreshKey} user={user} embedded={true} />
                )}
            </div>
        </div>
    );
}

export default TransactionsPage;
