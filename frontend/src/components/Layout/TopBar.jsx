import React from 'react';
import '../../styles/TopBar.css';

function TopBar({ user }) {
  return (
    <header className="top-bar">
      <div className="top-bar-content">
        <div className="top-bar-brand">
          <h1 className="page-title">Document Fraud Detection Portal</h1>
          <span className="security-badge">SECURE // ENCRYPTED</span>
        </div>
        <div className="top-bar-actions">
          <button className="icon-btn" title="Search">🔍</button>
          <button className="icon-btn notification" title="Alerts">
            🔔 <span className="notification-dot"></span>
          </button>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">{user?.role}</span>
            </div>
            <div className="user-avatar">
              <span>{user?.username?.charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;