import React, { useState, useEffect } from 'react';
import { AlertTriangle, List, FileText } from 'lucide-react';
import api from '../../services/api';
import AlertsManagement from '../Alerts/AlertsManagement';
import MyTransactions from './MyTransactions';
import '../../styles/TransactionsPage.css';

function TransactionsPage({ user }) {
    const [activeTab, setActiveTab] = useState('alerts');
    const [alertCount, setAlertCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);

    // Fetch counts for tab badges
    useEffect(() => {
        fetchCounts();
    }, []);

    const fetchCounts = async () => {
        try {
            // Fetch alert count
            const alertsResponse = await api.get('/transactions/alerts');
            setAlertCount(alertsResponse.data.alerts?.length || 0);

            // Fetch history count
            const historyResponse = await api.get('/transactions/my-transactions');
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
                    <div className="hero-label">TRANSACTION MANAGEMENT</div>
                    <h1 className="hero-title">Monitor Blockchain Transactions</h1>
                    <p className="hero-description">
                        Track high-risk alerts flagged by AI and view complete transaction history with blockchain verification.
                    </p>
                </div>

                {/* Stats Row */}
                <div className="hero-stats-row">
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
                            <div className="hero-stat-value">2</div>
                            <div className="hero-stat-label">CRITICAL</div>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(249, 115, 22, 0.2)' }}>
                            <AlertTriangle size={28} color="#f97316" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">2</div>
                            <div className="hero-stat-label">HIGH RISK</div>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                            <FileText size={28} color="#22c55e" />
                        </div>
                        <div className="hero-stat-info">
                            <div className="hero-stat-value">0</div>
                            <div className="hero-stat-label">MEDIUM RISK</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
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
                    className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    <List size={18} />
                    <span>History</span>
                    {historyCount > 0 && <span className="tab-badge">{historyCount}</span>}
                </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'alerts' && <AlertsManagement embedded={true} />}
                {activeTab === 'history' && <MyTransactions user={user} embedded={true} />}
            </div>
        </div>
    );
}

export default TransactionsPage;
