import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Dashboard from '../Dashboard/Dashboard';
import AlertsManagement from '../Alerts/AlertsManagement';
import CaseManagement from '../Cases/CaseManagement';
import Analytics from '../Analytics/Analytics';
import Profile from '../Profile/Profile';

function MainLayout({ user, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} setActiveView={setActiveView} onLogout={onLogout} />
      <div className="main-content">
        <TopBar user={user} />
        <div className="content-area">
          {activeView === 'dashboard' && <Dashboard user={user} />}
          {activeView === 'alerts' && <AlertsManagement />}
          {activeView === 'cases' && <CaseManagement />}
          {activeView === 'analytics' && <Analytics />}
          {activeView === 'profile' && <Profile user={user} />}
        </div>
      </div>
    </div>
  );
}

export default MainLayout;