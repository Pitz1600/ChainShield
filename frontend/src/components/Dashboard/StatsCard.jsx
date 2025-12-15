import React from 'react';

function StatsCard({ icon, label, value, subtitle, color }) {
  return (
    <div className="stats-card">
      <div className="stats-icon" style={{ background: `${color}20`, color }}>
        {icon}
      </div>
      <div className="stats-info">
        <div className="stats-label">{label}</div>
        <div className="stats-value">{value}</div>
        <div className="stats-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

export default StatsCard;