import React from 'react';
import '../styles/Header.css';

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-content">
          <div className="header-brand">
            <span className="brand-icon">🛡️</span>
            <div className="brand-info">
              <h1 className="brand-title">ChainShield</h1>
              <p className="brand-subtitle">Government Fraud Detection System</p>
            </div>
          </div>
          
          <div className="header-actions">
            <div className="status-badge">
              <span className="status-icon">📡</span>
              <span className="status-text">Live Monitoring</span>
            </div>
            
            <div className="user-info">
              <span className="user-icon">👤</span>
              <div className="user-details">
                <p className="user-name">{user?.username}</p>
                <p className="user-role">{user?.role}</p>
              </div>
            </div>
            
            <button onClick={onLogout} className="logout-button">
              <span className="logout-icon">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;