import React from 'react';
import '../styles/Stats.css';

function Stats({ stats }) {
  const statItems = [
    { 
      label: 'Total Alerts', 
      value: stats?.totalAlerts || '0', 
      icon: '⚠️', 
      change: '+12%',
      positive: true
    },
    { 
      label: 'Critical Cases', 
      value: stats?.criticalCases || '0', 
      icon: '🛡️', 
      change: '+5%',
      positive: true
    },
    { 
      label: 'Under Review', 
      value: stats?.underReview || '0', 
      icon: '📈', 
      change: '-3%',
      positive: false
    },
    { 
      label: 'Resolved', 
      value: stats?.resolved || '0', 
      icon: '✅', 
      change: '+18%',
      positive: true
    }
  ];

  return (
    <div className="stats-grid">
      {statItems.map((stat, idx) => (
        <div key={idx} className="stat-card">
          <div className="stat-header">
            <span className="stat-icon">{stat.icon}</span>
            <span className={`stat-change ${stat.positive ? 'positive' : 'negative'}`}>
              {stat.change}
            </span>
          </div>
          <p className="stat-label">{stat.label}</p>
          <p className="stat-value">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

export default Stats;