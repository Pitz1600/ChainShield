import React, { useState } from 'react';
import AlertDetail from './AlertDetail';
import '../styles/AlertsList.css';

function AlertsList({ alerts, onAlertUpdate }) {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  const filteredAlerts = alerts.filter(alert => {
    const matchesFilter = filter === 'all' || alert.severity === filter;
    const matchesSearch = 
      alert.txHash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      alert.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const exportAlerts = () => {
    const csv = [
      ['Timestamp', 'TX Hash', 'Severity', 'Type', 'Risk Score', 'Status'],
      ...filteredAlerts.map(a => [
        new Date(a.timestamp).toISOString(),
        a.txHash,
        a.severity,
        a.type,
        a.riskScore,
        a.status
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alerts-${Date.now()}.csv`;
    link.click();
  };

  if (selectedAlert) {
    return (
      <AlertDetail 
        alert={selectedAlert} 
        onClose={() => setSelectedAlert(null)}
        onUpdate={onAlertUpdate}
      />
    );
  }

  return (
    <div className="alerts-container">
      <div className="alerts-filters">
        <div className="search-wrapper">
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
          <button
            onClick={() => setFilter('all')}
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('critical')}
            className={`filter-btn critical ${filter === 'critical' ? 'active' : ''}`}
          >
            Critical
          </button>
          <button
            onClick={() => setFilter('high')}
            className={`filter-btn high ${filter === 'high' ? 'active' : ''}`}
          >
            High
          </button>
          <button onClick={exportAlerts} className="export-btn">
            <span className="export-icon">📥</span>
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="no-alerts">
            <span className="no-alerts-icon">🔍</span>
            <p className="no-alerts-text">No alerts found matching your filters</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div 
              key={alert.id} 
              className="alert-card"
              onClick={() => setSelectedAlert(alert)}
            >
              <div className="alert-header">
                <div className="alert-info">
                  <div className="alert-badges">
                    <span className={`severity-badge ${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className={`status-badge ${alert.status}`}>
                      {alert.status.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="alert-time">
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="alert-type">{alert.type}</h3>
                  <p className="alert-hash">{alert.txHash}</p>
                  <p className="alert-reason">{alert.reason}</p>
                </div>
                <div className="alert-score">
                  <span className="score-label">Risk Score</span>
                  <p className={`score-value risk-${alert.severity}`}>
                    {alert.riskScore}
                  </p>
                  <p className="alert-amount">{alert.amount}</p>
                </div>
              </div>
              <div className="alert-actions">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAlert(alert);
                  }}
                  className="btn-investigate"
                >
                  <span className="btn-icon">👁️</span>
                  <span>Investigate</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AlertsList;
