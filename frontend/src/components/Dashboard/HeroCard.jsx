import React from 'react';

function HeroCard({ title, subtitle, stats }) {
  return (
    <div className="hero-card">
      <div className="hero-content">
        <span className="hero-tag">FRAUD DETECTION WORKSPACE</span>
        <h2 className="hero-title">{title}</h2>
        <p className="hero-subtitle">{subtitle}</p>
      </div>
      {stats && (
        <div className="hero-stats">
          {stats.map((stat, index) => (
            <div key={index} className="hero-stat">
              <div className="hero-stat-value">{stat.value}</div>
              <div className="hero-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HeroCard;