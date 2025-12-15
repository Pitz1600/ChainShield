import React, { useState } from 'react';
import AlertCard from './AlertCard';
import '../../styles/Alerts.css';

function AlertsManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const alerts = [
    {
      id: '1',
      severity: 'critical',
      type: 'Procurement Fraud',
      txHash: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      amount: '145,000 ETH',
      riskScore: 92,
      status: 'open',
      time: '2 minutes ago'
    },
    {
      id: '2',
      severity: 'high',
      type: 'Tax Evasion',
      txHash: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      amount: '28,500 ETH',
      riskScore: 78,
      status: 'under_review',
      time: '1 hour ago'
    },
    {
      id: '3',
      severity: 'medium',
      type: 'Welfare Fraud',
      txHash: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      amount: '5,200 ETH',
      riskScore: 65,
      status: 'open',
      time: '3 hours ago'
    }
  ];

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter;
    const matchesSearch = alert.txHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="alerts-container">
      <div className="page-hero alerts-hero">
        <span className="hero-tag">ALERTS MANAGEMENT</span>
        <h2 className="hero-title">Monitor fraud alerts</h2>
        <p className="hero-subtitle">Search, filter, and investigate suspicious transactions flagged by the system.</p>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by transaction hash or fraud type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-buttons">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`filter-btn ${filter === 'critical' ? 'active' : ''}`} onClick={() => setFilter('critical')}>Critical</button>
          <button className={`filter-btn ${filter === 'high' ? 'active' : ''}`} onClick={() => setFilter('high')}>High</button>
          <button className="export-btn">📥 Export</button>
        </div>
      </div>

      <div className="alerts-grid">
        {filteredAlerts.map(alert => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}

export default AlertsManagement;