import React from 'react';
import { Shield, Zap, Target, BarChart3, Lock, LogIn, FileText, Search, AlertTriangle, Edit } from 'lucide-react';
import '../../styles/Welcome.css';

function Welcome({ onNavigate }) {
  return (
    <div className="welcome-container">
      <div className="welcome-sidebar">
        <div className="sidebar-content">
          <div className="brand-section">
            <div className="brand-logo">
              <div className="logo-shield"><img src="/ChainShield_logo.png" alt="ChainShield Logo" className="logo-welcome" /></div>
            </div>
            <h1 className="brand-name">ChainShield</h1>
            <p className="brand-tagline">Barangay Transaction Integrity Monitoring System</p>
          </div>

          <div className="features-section">
            <div className="feature-item">
              <div className="feature-icon"><Zap size={32} /></div>
              <div className="feature-content">
                <h3 className="feature-title">Real-Time Monitoring</h3>
                <p className="feature-description">Track barangay record transactions on blockchain instantly</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon"><Target size={32} /></div>
              <div className="feature-content">
                <h3 className="feature-title">AI-Powered Detection</h3>
                <p className="feature-description">Identify suspicious patterns and transaction anomalies</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon"><BarChart3 size={32} /></div>
              <div className="feature-content">
                <h3 className="feature-title">Audit Trail Reports</h3>
                <p className="feature-description">Complete document transaction history and analytics</p>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon"><Lock size={32} /></div>
              <div className="feature-content">
                <h3 className="feature-title">Tamper-Proof Records</h3>
                <p className="feature-description">Blockchain-secured document verification system</p>
              </div>
            </div>
          </div>

          <div className="sidebar-footer">
            {/* Stats removed as requested */}
          </div>
        </div>
      </div>

      <div className="welcome-main">
        <div className="welcome-content">
          <div className="welcome-header">
            <span className="welcome-badge">Barangay Portal</span>
            <h2 className="welcome-title">Protecting Barangay Transactions Through Blockchain</h2>
            <p className="welcome-description">
              Secure transaction tracking system using blockchain technology. Monitor financial flows,
              disbursements, and official transactions to ensure integrity and prevent irregularities.
            </p>
          </div>

          <div className="action-buttons">
            <button className="btn-primary" onClick={() => onNavigate('login')}>
              <span className="btn-icon"><LogIn size={20} /></span>
              <span>Sign In to Portal</span>
            </button>
            <button className="btn-secondary" onClick={() => onNavigate('register')}>
              <span className="btn-icon"><Edit size={20} /></span>
              <span>Create New Account</span>
            </button>
          </div>

          <div className="info-cards">
            <div className="info-card">
              <div className="info-card-icon blue"><FileText size={28} /></div>
              <h4 className="info-card-title">Document Verification</h4>
              <p className="info-card-text">Verify authenticity of barangay-issued documents and certificates</p>
            </div>

            <div className="info-card">
              <div className="info-card-icon green"><Search size={28} /></div>
              <h4 className="info-card-title">Transaction Tracking</h4>
              <p className="info-card-text">Monitor all document modifications and access attempts</p>
            </div>

            <div className="info-card">
              <div className="info-card-icon orange"><AlertTriangle size={28} /></div>
              <h4 className="info-card-title">Anomaly Detection</h4>
              <p className="info-card-text">Identify suspicious patterns and unusual transaction activity</p>
            </div>
          </div>

          <div className="security-notice">
            <span className="notice-icon"><Lock size={20} /></span>
            <span className="notice-text">All document transactions are encrypted and stored on blockchain. This system complies with government security standards.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Welcome;