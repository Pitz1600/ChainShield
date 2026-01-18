import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import Dashboard from '../Dashboard/Dashboard';
import AlertsManagement from '../Alerts/AlertsManagement';
import CaseManagement from '../Cases/CaseManagement';
import Analytics from '../Analytics/Analytics';
import Profile from '../Profile/Profile';
import '../../styles/MainLayout.css';

function MainLayout({ user, onLogout }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="app-layout">
      <Sidebar 
        activeView={activeView} 
        setActiveView={setActiveView} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
      />
      {isSidebarOpen && window.innerWidth < 768 && (
        <div className="sidebar-backdrop" onClick={toggleSidebar}></div>
      )}
      <div className={`main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <TopBar user={user} toggleSidebar={toggleSidebar} />
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