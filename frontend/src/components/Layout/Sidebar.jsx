import React from 'react';
import '../../styles/Sidebar.css';

function Sidebar({ user, activeView, setActiveView, onLogout, isMobileMenuOpen, toggleMobileMenu }) {
  const menuItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'alerts', icon: '⚠️', label: 'Transaction Alerts' },
    { id: 'csvimport', icon: '📊', label: 'CSV Import' },
    { id: 'analytics', icon: '📈', label: 'Analytics' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
  ];

  const showNav = user?.isVerified;

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={toggleMobileMenu}></div>
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">🛡️</div>
            <div className="logo-text">
              <h2 className="logo-title">CHAINSHIELD</h2>
              <p className="logo-subtitle">Government Portal</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={toggleMobileMenu}>
            ✕
          </button>
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
    </>
  );
}

export default Sidebar;