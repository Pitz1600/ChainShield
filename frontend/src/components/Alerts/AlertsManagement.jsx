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
      type: 'Forged Birth Certificate',
      documentId: 'PSA-2024-BC-001234',
      documentType: 'PSA Birth Certificate',
      issuer: 'Philippine Statistics Authority',
      riskScore: 92,
      status: 'open',
      time: '2 minutes ago'
    },
    {
      id: '2',
      severity: 'high',
      type: 'Duplicate Driver License',
      documentId: 'LTO-2024-DL-567890',
      documentType: 'LTO Driver License',
      issuer: 'Land Transportation Office',
      riskScore: 78,
      status: 'under_review',
      time: '1 hour ago'
    },
    {
      id: '3',
      severity: 'medium',
      type: 'Modified Land Title',
      documentId: 'RD-2024-LT-987654',
      documentType: 'Registry of Deeds',
      issuer: 'Registry of Deeds',
      riskScore: 65,
      status: 'open',
      time: '3 hours ago'
    }
  ];

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter;
    const matchesSearch = alert.documentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="alerts-container">
      <div className="page-hero alerts-hero">
        <span className="hero-tag">DOCUMENT ALERTS MANAGEMENT</span>
        <h2 className="hero-title">Monitor document fraud alerts</h2>
        <p className="hero-subtitle">Search, filter, and investigate suspicious document transactions flagged by the system.</p>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search by document ID or fraud type..."
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