import React from 'react';
import { Menu } from 'lucide-react';
import '../../styles/TopBar.css';
import '../../styles/ColorfulIcons.css';

function TopBar({ toggleMobileMenu }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    toggleMobileMenu();
  };

  return (
    <header className="top-bar">
      <div className="top-bar-content">
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
        <div className="top-bar-spacer" aria-hidden="true" />
      </div>
    </header>
  );
}

export default TopBar;
