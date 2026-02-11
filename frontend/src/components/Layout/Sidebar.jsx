import React from 'react';
import { Home, AlertTriangle, List, Upload, BarChart3, Search, Settings, User, Shield, LogOut } from 'lucide-react';
import { isAdmin, isOfficial } from '../../utils/permissions';
import '../../styles/Sidebar.css';

function Sidebar({ user, activeView, setActiveView, onLogout, isMobileMenuOpen, toggleMobileMenu }) {
  // Icon mapping
  const iconMap = {
    home: Home,
    alert: AlertTriangle,
    history: List,
    upload: Upload,
    chart: BarChart3,
    search: Search,
    settings: Settings,
    user: User,
    shield: Shield
  };

  // Base menu items for all users
  const baseMenuItems = [
    { id: 'dashboard', icon: 'home', label: 'Dashboard', roles: ['resident', 'barangay_official', 'administrator'] },
    { id: 'transactions', icon: 'history', label: 'Transactions', roles: ['resident', 'barangay_official', 'administrator'] },
  ];

  // Resident-specific menu items (view-only features)
  const residentMenuItems = [
    // Transaction history is now part of Transactions page
  ];

  // Official and admin menu items
  const officialMenuItems = [
    { id: 'csvimport', icon: 'upload', label: 'CSV Import', roles: ['barangay_official', 'administrator'] },
    { id: 'analytics', icon: 'chart', label: 'Analytics', roles: ['barangay_official', 'administrator'] },
  ];

  // Admin-only menu items
  const adminMenuItems = [
    { id: 'admin', icon: 'settings', label: 'Admin Panel', roles: ['administrator'] },
  ];

  // Profile (everyone)
  const profileMenuItem = { id: 'profile', icon: 'user', label: 'My Profile', roles: ['resident', 'barangay_official', 'administrator'] };

  // Build menu based on user role
  const getMenuItems = () => {
    let items = [...baseMenuItems];

    // Add resident items for everyone
    items = [...items, ...residentMenuItems];

    // Add official items if user is official or admin
    if (isOfficial(user)) {
      items = [...items, ...officialMenuItems];
    }

    // Add admin items if user is admin
    if (isAdmin(user)) {
      items = [...items, ...adminMenuItems];
    }

    // Add profile at the end
    items = [...items, profileMenuItem];

    return items;
  };

  const menuItems = getMenuItems();
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
            <div className="logo-icon">
              <img
                src="/ChainShield_logo.png"
                alt="ChainShield Logo"
                className="logo-sidebar"
                draggable="false"
              />
            </div>
            <div className="logo-text">
              <h2 className="logo-title">CHAINSHIELD</h2>
              <p className="logo-subtitle">Barangay Portal</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={toggleMobileMenu}>
            ✕
          </button>
        </div>

        <nav className="sidebar-nav">
          {showNav && menuItems.map(item => {
            const IconComponent = iconMap[item.icon];
            return (
              <button
                key={item.id}
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => setActiveView(item.id)}
              >
                <span className="nav-icon">
                  <IconComponent size={20} strokeWidth={2} />
                </span>
                <span className="nav-label">{item.label}</span>
              </button>
            );
          })}
          {!showNav && (
            <div style={{ padding: '1rem', color: '#9ca3af', textAlign: 'center', fontSize: '0.9rem' }}>
              Pending Verification
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={onLogout} className="logout-btn">
            <span><LogOut size={18} /></span>
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
