import React from 'react';
import HeroCard from './HeroCard';
import StatsCard from './StatsCard';
import '../../styles/Dashboard.css';

function Dashboard({ user }) {
  const statsData = [
    { icon: '⚠️', label: 'Total Alerts', value: '1,247', subtitle: 'Across all filters', color: '#ef4444' },
    { icon: '🔴', label: 'Critical Cases', value: '23', subtitle: 'Requires immediate action', color: '#f97316' },
    { icon: '📈', label: 'Under Review', value: '156', subtitle: 'In progress', color: '#eab308' },
    { icon: '✅', label: 'Resolved', value: '1,068', subtitle: 'Successfully closed', color: '#22c55e' },
  ];

  const recentAlerts = [
    { id: 1, severity: 'critical', type: 'Procurement Fraud', amount: '145,000 ETH', score: 92, time: '2 minutes ago' },
    { id: 2, severity: 'high', type: 'Tax Evasion', amount: '28,500 ETH', score: 78, time: '1 hour ago' },
    { id: 3, severity: 'medium', type: 'Welfare Fraud', amount: '5,200 ETH', score: 65, time: '3 hours ago' },
  ];

  return (
    <div className="dashboard-container">
      <HeroCard 
        title={`Welcome back, ${user.username}!`}
        subtitle="Monitor alerts, investigate cases, and maintain the integrity of public financial transactions."
        stats={[
          { label: 'Active Alerts', value: '23' },
          { label: 'Open Cases', value: '8' }
        ]}
      />

      <div className="stats-grid">
        {statsData.map((stat, index) => (
          <StatsCard key={index} {...stat} />
        ))}
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <h3 className="card-title">Recent Alerts</h3>
          <p className="card-subtitle">Latest fraud detection alerts requiring attention</p>
          <div className="alerts-list">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <div className="alert-info">
                  <span className={`severity-dot ${alert.severity}`}></span>
                  <div>
                    <div className="alert-type">{alert.type}</div>
                    <div className="alert-time">{alert.time}</div>
                  </div>
                </div>
                <div className="alert-meta">
                  <div className="alert-amount">{alert.amount}</div>
                  <div className={`alert-score ${alert.severity}`}>{alert.score}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card">
          <h3 className="card-title">Risk Snapshot</h3>
          <p className="card-subtitle">Current fraud risk distribution</p>
          <div className="risk-bars">
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot critical"></span>
                <span>High Risk</span>
              </div>
              <span className="risk-count">1</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot medium"></span>
                <span>Medium Risk</span>
              </div>
              <span className="risk-count">0</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot low"></span>
                <span>Low Risk</span>
              </div>
              <span className="risk-count">0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;