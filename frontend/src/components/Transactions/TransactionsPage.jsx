import React, { useState, useEffect } from 'react';
import { AlertTriangle, List, FileText } from 'lucide-react';
import api from '../../services/api';
import AlertsManagement from '../Alerts/AlertsManagement';
import MyTransactions from './MyTransactions';
import ResidentTransactions from './ResidentTransactions';
import '../../styles/TransactionsPage.css';

function TransactionsPage({ user }) {
    const isResident = user?.role === 'resident';
    const [activeTab, setActiveTab] = useState(isResident ? 'ledger' : 'alerts');
    const [alertCount, setAlertCount] = useState(0);
    const [criticalCount, setCriticalCount] = useState(0);
    const [highCount, setHighCount] = useState(0);
    const [mediumCount, setMediumCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);

    useEffect(() => { fetchCounts(); }, []);

    const fetchCounts = async () => {
        try {
            const alertsResponse = await api.get('/transactions/alerts?limit=5000');
            const allAlerts = alertsResponse.data.alerts || [];
            setAlertCount(allAlerts.length || 0);
            setCriticalCount(allAlerts.filter((a) => Number(a.riskScore || 0) >= 90).length);
            setHighCount(allAlerts.filter((a) => Number(a.riskScore || 0) >= 71 && Number(a.riskScore || 0) < 90).length);
            setMediumCount(allAlerts.filter((a) => Number(a.riskScore || 0) >= 41 && Number(a.riskScore || 0) < 71).length);
            const historyResponse = await api.get('/transactions/my-transactions', { params: { includeStaged: true } });
            setHistoryCount(historyResponse.data.count || 0);
        } catch (error) {
            console.error('Error fetching counts:', error);
        }
    };

    return (
        <div className="transactions-page">
            {/* Hero Section */}
            <div className="admin-hero transactions-hero">
                <div className="hero-text-section">
                    <div className="hero-label">
                        {isResident ? 'PUBLIC SPENDING RECORDS' : 'TRANSACTION MANAGEMENT'}
                    </div>
                    <h1 className="hero-title">
                        {isResident ? 'Barangay Budget Transactions' : 'Monitor Blockchain Transactions'}
                    </h1>
                    <p className="hero-description">
                        {isResident
                            ? 'View all public spending records for Barangay Pantal. Click any transaction to see details or report a concern.'
                            : 'Track high-risk alerts flagged by AI and view complete transaction history with blockchain verification.'}
                    </p>
                </div>

                {/* Stats Row */}
                <div className="hero-stats-row">
                    {isResident ? (
                        /* Resident sees simple counts */
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
                                    <div className="hero-stat-value">{historyCount - alertCount}</div>
                                    <div className="hero-stat-label">VERIFIED</div>
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
                    ) : (
                        /* Admin/official sees risk breakdown */
                        <>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{alertCount}</div>
                                    <div className="hero-stat-label">TOTAL ALERTS</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.2)' }}>
                                    <AlertTriangle size={28} color="#ef4444" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{criticalCount}</div>
                                    <div className="hero-stat-label">CRITICAL</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
                                    <AlertTriangle size={28} color="#f97316" />
                                </div>
                                <div className="hero-stat-info">
                                    <div className="hero-stat-value">{highCount}</div>
                                    <div className="hero-stat-label">HIGH RISK</div>
                                </div>
                            </div>
                            <div className="hero-stat-card">
                                <div className="hero-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
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

            {/* Tabs — residents only see one tab */}
            {!isResident && (
                <div className="transactions-tabs">
                    <button
                        className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
                        onClick={() => setActiveTab('alerts')}
                    >
                        <AlertTriangle size={18} />
                        <span>Alerts</span>
                        {alertCount > 0 && <span className="tab-badge">{alertCount}</span>}
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'ledger' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ledger')}
                    >
                        <List size={18} />
                        <span>All Transactions</span>
                        {historyCount > 0 && <span className="tab-badge">{historyCount}</span>}
                    </button>
                </div>
            )}

            {/* Content */}
            <div className="tab-content">
                {isResident
                    ? <ResidentTransactions user={user} embedded={true} />
                    : activeTab === 'alerts'
                        ? <AlertsManagement embedded={true} user={user} />
                        : <MyTransactions user={user} embedded={true} />
                }
            </div>
        </div>
    );
}

export default TransactionsPage;