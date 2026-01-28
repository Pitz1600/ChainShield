import React from 'react';
import '../../styles/Sidebar.css';

function Sidebar({ activeView, setActiveView, onLogout, user }) {
  const menuItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'alerts', icon: '⚠️', label: 'Document Alerts' },
    { id: 'cases', icon: '📁', label: 'Fraud Cases' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
  ];

  const showNav = user?.isVerified;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div className="logo-text">
            <h2 className="logo-title">CHAINSHIELD</h2>
            <p className="logo-subtitle">Government Portal</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {showNav && menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
        {!showNav && (
          <div style={{ padding: '1rem', color: '#9ca3af', textAlign: 'center', fontSize: '0.9rem' }}>
            Pending Verification
          </div>
        )}
      </nav>

      <div className="sidebar-footer">
        <button onClick={onLogout} className="logout-btn">
          <span>🚪</span>
          <span>Logout Portal</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;