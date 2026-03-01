import React, { useState, lazy, Suspense } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../styles/MainLayout.css';

// Lazy load components for better performance and Firefox compatibility
const Dashboard = lazy(() => import('../Dashboard/Dashboard'));
const TransactionsPage = lazy(() => import('../Transactions/TransactionsPage'));
const Analytics = lazy(() => import('../Analytics/Analytics'));
const Profile = lazy(() => import('../Profile/Profile'));
const CSVImport = lazy(() => import('../CSVImport/CSVImport'));
const AdminPanel = lazy(() => import('../Admin/AdminPanel'));
const DocumentVerification = lazy(() => import('../DocumentVerification/DocumentVerification'));
const SubmitComplaint = lazy(() => import('../Complaints/SubmitComplaint'));
const Feedbacks = lazy(() => import('../Feedbacks/Feedbacks'));

function MainLayout({ user, onLogout, onNavigate }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
    setIsMobileMenuOpen(false); // Close mobile menu when navigating
  };

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        activeView={activeView}
        setActiveView={handleViewChange}
        onLogout={onLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
      />
      <div className="main-content">
        <TopBar user={user} toggleMobileMenu={toggleMobileMenu} />
        <div className="content-area">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
              </div>
            </div>
          }>
            {activeView === 'dashboard' && <Dashboard user={user} onNavigate={onNavigate} />}
            {activeView === 'transactions' && <TransactionsPage user={user} />}
            {activeView === 'feedbacks' && <Feedbacks user={user} />}
            {activeView === 'analytics' && <Analytics user={user} />}
            {activeView === 'csvimport' && <CSVImport user={user} />}
            {activeView === 'admin' && <AdminPanel user={user} />}
            {activeView === 'profile' && <Profile user={user} />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;
