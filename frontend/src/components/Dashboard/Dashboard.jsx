import React from 'react';
import HeroCard from './HeroCard';
import StatsCard from './StatsCard';
import '../../styles/Dashboard.css';

function Dashboard({ user }) {
  const statsData = [
    { icon: '⚠️', label: 'Total Alerts', value: '1,247', subtitle: 'Fraud alerts detected', color: '#ef4444' },
    { icon: '🔴', label: 'Critical Cases', value: '23', subtitle: 'Requires immediate action', color: '#f97316' },
    { icon: '📈', label: 'Under Review', value: '156', subtitle: 'Being investigated', color: '#eab308' },
    { icon: '✅', label: 'Resolved', value: '1,068', subtitle: 'Successfully closed', color: '#22c55e' },
  ];

  const recentAlerts = [
    { id: 1, severity: 'critical', type: 'Welfare Fraud', transactionType: 'Social Welfare', agency: 'DSWD', score: 92, time: '2 minutes ago' },
    { id: 2, severity: 'high', type: 'Procurement Fraud', transactionType: 'Procurement', agency: 'DOH', score: 78, time: '1 hour ago' },
    { id: 3, severity: 'medium', type: 'Fund Convergence', transactionType: 'Social Welfare', agency: 'DSWD', score: 65, time: '3 hours ago' },
  ];

  return (
    <div className="dashboard-container">
      <HeroCard 
        title={`Welcome back, ${user.username}!`}
        subtitle="Monitor Philippine government financial transactions, detect fraud patterns, and maintain transparent audit trails using AI and blockchain technology."
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
          <div className="card-header">
            <div>
              <h3 className="card-title">Recent Alerts</h3>
              <p className="card-subtitle">Latest fraud alerts from government transactions</p>
            </div>
            <button className="btn-link">View All</button>
          </div>
          <div className="alerts-list">
            {recentAlerts.map(alert => (
              <div key={alert.id} className="alert-item">
                <div className="alert-info">
                  <span className={`severity-dot ${alert.severity}`}></span>
                  <div>
                    <div className="alert-type">{alert.type}</div>
                    <div className="alert-time">{alert.transactionType} • {alert.agency} • {alert.time}</div>
                  </div>
                </div>
                <div className="alert-meta">
                  <div className={`alert-score ${alert.severity}`}>{alert.score} Risk Score</div>
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
              <div className="progress-bg"><div style={{width: '15%'}} className="progress-fill critical"></div></div>
              <span className="risk-count">23</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot medium"></span>
                <span>Medium Risk</span>
              </div>
              <div className="progress-bg"><div style={{width: '45%'}} className="progress-fill medium"></div></div>
              <span className="risk-count">156</span>
            </div>
            <div className="risk-bar-item">
              <div className="risk-bar-label">
                <span className="risk-dot low"></span>
                <span>Low Risk</span>
              </div>
              <div className="progress-bg"><div style={{width: '30%'}} className="progress-fill low"></div></div>
              <span className="risk-count">89</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;