import React from 'react';
import '../../styles/TopBar.css';

function TopBar({ user }) {
  return (
    <header className="top-bar">
      <div className="top-bar-content">
        <h1 className="page-title">Fraud Detection Portal</h1>
        <div className="top-bar-actions">
          <button className="icon-btn">🔍</button>
          <button className="icon-btn">🔔</button>
          <div className="user-avatar">
            <span>👤</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;