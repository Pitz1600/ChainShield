import React, { useState, lazy, Suspense } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import '../../styles/MainLayout.css';

// Lazy load components for better performance and Firefox compatibility
const Dashboard = lazy(() => import('../Dashboard/Dashboard'));
const AlertsManagement = lazy(() => import('../Alerts/AlertsManagement'));
const Analytics = lazy(() => import('../Analytics/Analytics'));
const Profile = lazy(() => import('../Profile/Profile'));
const CSVImport = lazy(() => import('../CSVImport/CSVImport'));

function MainLayout({ user, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={onLogout} />
      <div className="main-content">
        <TopBar user={user} />
        <div className="content-area">
          <Suspense fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
              </div>
            </div>
          }>
            {activeView === 'dashboard' && <Dashboard user={user} />}
            {activeView === 'alerts' && <AlertsManagement />}
            {activeView === 'analytics' && <Analytics />}
            {activeView === 'csvimport' && <CSVImport />}
            {activeView === 'profile' && <Profile user={user} />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default MainLayout;