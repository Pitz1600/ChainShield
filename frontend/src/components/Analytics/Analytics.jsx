import React from 'react';
import '../../styles/Analytics.css';

function Analytics() {
  return (
    <div className="analytics-container">
      <div className="page-hero analytics-hero">
        <span className="hero-tag">ANALYTICS DASHBOARD</span>
        <h2 className="hero-title">Insights across your operations</h2>
        <p className="hero-subtitle">Review document fraud trends, detection patterns, and system performance metrics.</p>
      </div>

      <div className="stats-grid">
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>📊</div>
          <div className="stats-info">
            <div className="stats-label">Documents Verified</div>
            <div className="stats-value">45,432</div>
            <div className="stats-subtitle">Last 30 days</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#22c55e20', color: '#22c55e' }}>🎯</div>
          <div className="stats-info">
            <div className="stats-label">Detection Accuracy</div>
            <div className="stats-value">96.8%</div>
            <div className="stats-subtitle">Model performance</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>⚡</div>
          <div className="stats-info">
            <div className="stats-label">Avg Response Time</div>
            <div className="stats-value">0.8s</div>
            <div className="stats-subtitle">Real-time processing</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>💰</div>
          <div className="stats-info">
            <div className="stats-label">Fraud Prevented</div>
            <div className="stats-value">₱2.4B</div>
            <div className="stats-subtitle">Estimated savings</div>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="card-title">Document Fraud Distribution</h3>
        <p className="card-subtitle">Breakdown by document type</p>
        <div className="chart-placeholder">
          <div className="donut-chart">
            <div className="donut-inner">
              <div className="donut-value">1,247</div>
              <div className="donut-label">Total Cases</div>
            </div>
          </div>
          <div className="chart-legend">
            {[
              { label: 'Birth Certificates', value: '35%', color: '#dc2626' },
              { label: 'Land Titles', value: '28%', color: '#f59e0b' },
              { label: 'Driver Licenses', value: '22%', color: '#3b82f6' },
              { label: 'Other Documents', value: '15%', color: '#8b5cf6' }
            ].map((item, idx) => (
              <div key={idx} className="legend-item">
                <div className="legend-color" style={{ background: item.color }}></div>
                <div className="legend-info">
                  <div className="legend-label">{item.label}</div>
                  <div className="legend-value">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;