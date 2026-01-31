import React from 'react';
import { Menu, Search, Bell } from 'lucide-react';
import '../../styles/TopBar.css';
import '../../styles/ColorfulIcons.css';

function TopBar({ user, toggleMobileMenu }) {
  return (
    <header className="top-bar">
      <div className="top-bar-content">
        <div className="top-bar-left">
          <button
            className="mobile-menu-btn"
            onClick={toggleMobileMenu}
            aria-label="Open navigation menu"
          >
            <Menu size={28} />
          </button>
          <div className="top-bar-brand">
            <h1
              className="page-title"
              title="Transaction Integrity Monitoring Portal"
            >
              <span className="title-full">Transaction Integrity Monitoring Portal</span>
              <span className="title-mobile">ChainShield Portal</span>
            </h1>
            <span
              className="security-badge"
              title="Secure and Encrypted"
            >
              <span className="badge-full">SECURE // ENCRYPTED</span>
              <span className="badge-mobile">SECURE</span>
            </span>
          </div>
        </div>
        <div className="top-bar-actions">
          <button
            className="icon-btn"
            title="Search"
            aria-label="Search"
          >
            <Search size={24} />
          </button>
          <button
            className="icon-btn notification"
            title="Alerts"
            aria-label="View alerts"
          >
            <Bell size={24} /> <span className="notification-dot"></span>
          </button>
          <div
            className="user-profile"
            title={`${user?.username || 'User'} (${user?.role || 'Role'})`}
          >
            <div className="user-info">
              <span className="user-name">{user?.username || 'User'}</span>
              <span className="user-role">{user?.role || 'Role'}</span>
            </div>
            <div className="user-avatar">
              <span>{(user?.username || 'U').charAt(0).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;