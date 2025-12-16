import React from 'react';
import '../../styles/Welcome.css';

function Welcome({ onNavigate }) {
  return (
    <div className="welcome-container">
      <div className="welcome-sidebar">
        <div className="sidebar-content">
          <div className="brand-section">
            <div className="brand-logo">
              <div className="logo-shield">🛡️</div>
            </div>
            <h1 className="brand-name">ChainShield</h1>
            <p className="brand-tagline">Government Fraud Detection System</p>
          </div>

          <div className="features-section">
            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <div className="feature-content">
                <h3 className="feature-title">Real-Time Detection</h3>
                <p className="feature-description">Monitor blockchain transactions for suspicious activity instantly</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🎯</div>
              <div className="feature-content">
                <h3 className="feature-title">AI-Powered Analysis</h3>
                <p className="feature-description">Machine learning algorithms detect complex fraud patterns</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <div className="feature-content">
                <h3 className="feature-title">Comprehensive Reports</h3>
                <p className="feature-description">Generate detailed investigation reports and analytics</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-content">
                <h3 className="feature-title">Secure & Compliant</h3>
                <p className="feature-description">Government-grade security with full audit trails</p>
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            <p className="footer-text">Trusted by government agencies nationwide</p>
            <div className="footer-stats">
              <div className="stat-item">
                <div className="stat-value">₱2.4B</div>
                <div className="stat-label">Fraud Prevented</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">15K+</div>
                <div className="stat-label">Cases Resolved</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="welcome-main">
        <div className="welcome-content">
          <div className="welcome-header">
            <span className="welcome-badge">Government Portal</span>
            <h2 className="welcome-title">Protecting Public Funds Through Advanced Technology</h2>
            <p className="welcome-description">
              Join the fight against financial fraud with our state-of-the-art detection system. 
              Monitor transactions, investigate cases, and safeguard public resources.
            </p>
          </div>

          <div className="action-buttons">
            <button className="btn-primary" onClick={() => onNavigate('login')}>
              <span className="btn-icon">🔐</span>
              <span>Sign In to Portal</span>
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('register')}>
              <span className="btn-icon">📝</span>
              <span>Create New Account</span>
            </button>
          </div>

          <div className="info-cards">
            <div className="info-card">
              <div className="info-card-icon blue">👥</div>
              <h4 className="info-card-title">For Government Agencies</h4>
              <p className="info-card-text">Access advanced fraud detection tools designed for public sector operations</p>
            </div>

            <div className="info-card">
              <div className="info-card-icon green">🔍</div>
              <h4 className="info-card-title">For Investigators</h4>
              <p className="info-card-text">Track and analyze suspicious transactions with powerful investigation tools</p>
            </div>

            <div className="info-card">
              <div className="info-card-icon orange">📈</div>
              <h4 className="info-card-title">For Analysts</h4>
              <p className="info-card-text">Generate insights and reports to prevent financial crimes</p>
            </div>
          </div>

          <div className="security-notice">
            <span className="notice-icon">🔒</span>
            <span className="notice-text">All data is encrypted and stored securely. This system complies with government security standards.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Welcome;