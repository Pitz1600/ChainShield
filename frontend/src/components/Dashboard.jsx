import React, { useState, useEffect } from 'react';
import Header from './Header';
import Stats from './Stats';
import AlertsList from './AlertsList';
import CaseManagement from './CaseManagement';
import TransactionGraph from './TransactionGraph';
import '../styles/Dashboard.css';

function Dashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    totalAlerts: 1247,
    criticalCases: 23,
    underReview: 156,
    resolved: 1068
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const mockAlerts = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          txHash: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          fromAddress: '0x1234567890abcdef',
          toAddress: '0xfedcba0987654321',
          amount: '145,000 ETH',
          riskScore: 92,
          severity: 'critical',
          type: 'Procurement Fraud',
          reason: 'Unusual amount, linked to flagged address, abnormal frequency',
          status: 'open',
          features: {
            'Amount Deviation': 0.95,
            'Frequency Anomaly': 0.87,
            'Network Risk': 0.92
          }
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          txHash: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
          fromAddress: '0xabcdef1234567890',
          toAddress: '0x0987654321fedcba',
          amount: '28,500 ETH',
          riskScore: 78,
          severity: 'high',
          type: 'Tax Evasion',
          reason: 'Multiple transactions to offshore addresses',
          status: 'under_review',
          features: {
            'Offshore Transfer': 0.89,
            'Pattern Match': 0.76
          }
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          txHash: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
          fromAddress: '0x9876543210abcdef',
          toAddress: '0xfedcba9876543210',
          amount: '5,200 ETH',
          riskScore: 65,
          severity: 'medium',
          type: 'Welfare Fraud',
          reason: 'Duplicate recipient addresses detected',
          status: 'open',
          features: {
            'Duplicate Detection': 0.71,
            'Identity Score': 0.58
          }
        }
      ];
      setAlerts(mockAlerts);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load alerts:', error);
      setLoading(false);
    }
  };

  const handleAlertUpdate = (alertId, updates) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, ...updates } : a));
  };

  const tabs = [
    { id: 'alerts', label: 'Alerts', icon: '📊' },
    { id: 'cases', label: 'Cases', icon: '📁' },
    { id: 'graph', label: 'Network Graph', icon: '🕸️' }
  ];

  return (
    <div className="dashboard">
      <Header user={user} onLogout={onLogout} />
      
      <div className="dashboard-container">
        <Stats stats={stats} />

        <div className="tabs-container">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Loading data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'alerts' && (
              <AlertsList alerts={alerts} onAlertUpdate={handleAlertUpdate} />
            )}
            {activeTab === 'cases' && <CaseManagement />}
            {activeTab === 'graph' && <TransactionGraph />}
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;