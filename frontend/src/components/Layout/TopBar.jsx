import React from 'react';
import { Menu } from 'lucide-react';
import '../../styles/TopBar.css';
import '../../styles/ColorfulIcons.css';

function TopBar({ user, toggleMobileMenu, setActiveView }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    toggleMobileMenu();
  };

  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

  return (
    <header className="top-bar">
      <div className="top-bar-content">
        <div className="top-bar-left">
          <button
            className="mobile-menu-btn"
            onClick={handleMenuToggle}
            aria-label="Open navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            <Menu size={24} />
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
          <div
            className="user-profile"
            title={`${user?.username || 'User'} (${user?.role || 'Role'})`}
            onClick={() => setActiveView('profile')}
            style={{ cursor: 'pointer' }}
          >
            <div className="user-info">
              <span className="user-name">{user?.username || 'User'}</span>
              <span className="user-role">{user?.role || 'Role'}</span>
            </div>
            <div className="user-avatar">
              {user?.profilePicture ? (
                <img
                  src={`${baseUrl}/uploads/${user.profilePicture}`}
                  alt="Avatar"
                  className="user-avatar-img"
                />
              ) : (
                <span>{(user?.username || 'U').charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
