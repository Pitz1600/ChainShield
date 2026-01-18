import React from 'react';
import '../../styles/Sidebar.css';

function Sidebar({ activeView, setActiveView, onLogout, isOpen, toggleSidebar }) {
  const menuItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'alerts', icon: '⚠️', label: 'Document Alerts' },
    { id: 'cases', icon: '📁', label: 'Fraud Cases' },
    { id: 'analytics', icon: '📊', label: 'Analytics' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && (
          <button className="back-btn" onClick={toggleSidebar} title="Close Sidebar">
            ← Back
          </button>
        )}
        <div className="sidebar-logo">
          <div className="logo-icon">🛡️</div>
          <div className="logo-text">
            <h2 className="logo-title">CHAINSHIELD</h2>
            <p className="logo-subtitle">Government Portal</p>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => setActiveView(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
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