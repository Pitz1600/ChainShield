import React from 'react';
import '../../styles/Analytics.css';

function Analytics() {
  return (
    <div className="analytics-container">
      <div className="page-hero analytics-hero">
        <span className="hero-tag">ANALYTICS DASHBOARD</span>
        <h2 className="hero-title">Insights across your operations</h2>
        <p className="hero-subtitle">Review fraud trends, detection patterns, and system performance metrics.</p>
      </div>

      <div className="stats-grid">
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>📊</div>
          <div className="stats-info">
            <div className="stats-label">Transactions Analyzed</div>
            <div className="stats-value">15,432</div>
            <div className="stats-subtitle">Last 30 days</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#22c55e20', color: '#22c55e' }}>🎯</div>
          <div className="stats-info">
            <div className="stats-label">Detection Accuracy</div>
            <div className="stats-value">94.2%</div>
            <div className="stats-subtitle">Model performance</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>⚡</div>
          <div className="stats-info">
            <div className="stats-label">Avg Response Time</div>
            <div className="stats-value">1.2s</div>
            <div className="stats-subtitle">Real-time processing</div>
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>💰</div>
          <div className="stats-info">
            <div className="stats-label">Fraud Prevented</div>
            <div className="stats-value">₱2.4M</div>
            <div className="stats-subtitle">Estimated savings</div>
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3 className="card-title">Fraud Distribution</h3>
        <p className="card-subtitle">Breakdown by fraud type</p>
        <div className="chart-placeholder">
          <div className="donut-chart">
            <div className="donut-inner">
              <div className="donut-value">1,247</div>
              <div className="donut-label">Total Cases</div>
            </div>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#dc2626' }}></div>
              <div className="legend-info">
                <div className="legend-label">Procurement Fraud</div>
                <div className="legend-value">45%</div>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#f59e0b' }}></div>
              <div className="legend-info">
                <div className="legend-label">Tax Evasion</div>
                <div className="legend-value">30%</div>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#3b82f6' }}></div>
              <div className="legend-info">
                <div className="legend-label">Welfare Fraud</div>
                <div className="legend-value">15%</div>
              </div>
            </div>
            <div className="legend-item">
              <div className="legend-color" style={{ background: '#8b5cf6' }}></div>
              <div className="legend-info">
                <div className="legend-label">Other</div>
                <div className="legend-value">10%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Analytics;