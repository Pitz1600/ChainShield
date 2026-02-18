import React from 'react';
import { Home, AlertTriangle, List, Upload, BarChart3, Search, Settings, User, Shield, LogOut, X } from 'lucide-react';
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

  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div className="sidebar-overlay" onClick={toggleMobileMenu}></div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="logout-modal-overlay">
          <div className="logout-modal">
            <div className="modal-icon-wrapper">
              <LogOut size={32} />
            </div>
            <h3 className="modal-title">Confirm Logout</h3>
            <p className="modal-message">
              Are you sure you want to end your session? You will need to sign in again to access the portal.
            </p>
            <div className="modal-actions">
              <button className="modal-btn btn-cancel" onClick={cancelLogout}>
                Cancel
              </button>
              <button className="modal-btn btn-confirm" onClick={confirmLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className={`sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-icon">
              <Shield size={32} strokeWidth={2} />
            </div>
            <div className="logo-text">
              <h2 className="logo-title">CHAINSHIELD</h2>
              <p className="logo-subtitle">Barangay Portal</p>
            </div>
          </div>
          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={toggleMobileMenu}>
            <X size={24} />
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
          <button onClick={handleLogoutClick} className="logout-btn">
            <span><LogOut size={18} /></span>
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
