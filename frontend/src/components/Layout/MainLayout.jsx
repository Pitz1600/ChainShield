import React, { useState, lazy, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../styles/MainLayout.css';

// Lazy load components for better performance and Firefox compatibility
const Dashboard = lazy(() => import('../Dashboard/Dashboard'));
const ResidentDashboard = lazy(() => import('../Dashboard/ResidentDashboard'));
const TransactionsPage = lazy(() => import('../Transactions/TransactionsPage'));
const Analytics = lazy(() => import('../Analytics/Analytics'));
const IntegrityChecker = lazy(() => import('../IntegrityChecker/IntegrityChecker'));
const AdminPanel = lazy(() => import('../Admin/AdminPanel'));
const DocumentVerification = lazy(() => import('../DocumentVerification/DocumentVerification'));
const SubmitComplaint = lazy(() => import('../Complaints/SubmitComplaint'));
const Feedbacks = lazy(() => import('../Feedbacks/Feedbacks'));
const Profile = lazy(() => import('../Profile/Profile'));

function MainLayout({ user, onLogout, onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const pathToView = useMemo(() => {
    const path = location.pathname.replace(/\/+$/, '');
    if (path === '/dashboard' || path === '') return 'dashboard';
    if (path.startsWith('/dashboard/')) {
      const segment = path.replace('/dashboard/', '');
      switch (segment) {
        case 'transactions': return 'transactions';
        case 'analytics': return 'analytics';
        case 'integrity-checker': return 'integrity_checker';
        case 'admin': return 'admin';
        case 'feedbacks': return 'feedbacks';
        case 'profile': return 'profile';
        default: return 'dashboard';
      }
    }
    return 'dashboard';
  }, [location.pathname]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleViewChange = (view) => {
    const viewToPath = {
      dashboard: '/dashboard',
      transactions: '/dashboard/transactions',
      analytics: '/dashboard/analytics',
      integrity_checker: '/dashboard/integrity-checker',
      admin: '/dashboard/admin',
      feedbacks: '/dashboard/feedbacks',
      profile: '/dashboard/profile'
    };
    navigate(viewToPath[view] || '/dashboard');
    setIsMobileMenuOpen(false); // Close mobile menu when navigating
  };

  return (
    <div className="app-layout">
      <Sidebar
        user={user}
        activeView={pathToView}
        setActiveView={handleViewChange}
        onLogout={onLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        toggleMobileMenu={toggleMobileMenu}
      />
      <div className="main-content">
        <TopBar
          user={user}
          toggleMobileMenu={toggleMobileMenu}
        />
        <div className="content-area">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
              </div>
            </div>
          }>
            {pathToView === 'dashboard' && (
              user?.role === 'resident'
                ? <ResidentDashboard user={user} onNavigate={handleViewChange} />
                : <Dashboard user={user} onNavigate={onNavigate} />
            )}
            {pathToView === 'transactions' && <TransactionsPage user={user} />}
            {pathToView === 'analytics' && <Analytics user={user} />}
            {pathToView === 'integrity_checker' && <IntegrityChecker user={user} />}
            {pathToView === 'admin' && <AdminPanel user={user} />}
            {pathToView === 'feedbacks' && <Feedbacks user={user} />}
            {pathToView === 'profile' && <Profile user={user} />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;