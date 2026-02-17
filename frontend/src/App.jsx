import React, { useState, useEffect } from 'react';
import Welcome from './components/Auth/Welcome';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import EmailVerify from './components/Auth/EmailVerify';
import TwoFactorSetup from './components/Auth/TwoFactorSetup';
import ForcePasswordChange from './components/Auth/ForcePasswordChange';
import ResetPassword from './components/Auth/ResetPassword';
import MainLayout from './components/Layout/MainLayout';
import IdleTimer from './components/Auth/IdleTimer';
import { authAPI } from './services/api';

function App() {
  const [view, setView] = useState('welcome');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Authenticated user
  const [pendingUser, setPendingUser] = useState(null); // User for verification
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing authentication on mount
    const checkAuth = () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');

      if (token && userData) {
        try {
          const parsedUser = JSON.parse(userData);

          // Check if user is verified
          if (!parsedUser.isVerified) {
            // User is not verified - redirect to email verification
            setPendingUser(parsedUser);
            setView('email-verify');
          } else {
            // User is verified - proceed to dashboard
            setIsAuthenticated(true);
            setUser(parsedUser);
            setView('dashboard');
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogin = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
    setView('dashboard');
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setPendingUser(null);
    setView('welcome');
  };

  const handleNavigate = (newView, data = null) => {
    if (data) {
      setPendingUser(data);
    }
    setView(newView);
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.875rem' }}>Verifying System Integrity...</p>
      </div>
    );
  }

  if (view === 'welcome') return <Welcome onNavigate={handleNavigate} />;
  if (view === 'login') return <Login onLogin={handleLogin} onNavigate={handleNavigate} />;
  if (view === 'register') return <Register onRegister={handleLogin} onNavigate={handleNavigate} />;
  if (view === 'email-verify') return <EmailVerify user={pendingUser} onNavigate={handleNavigate} onLogin={handleLogin} />;
  if (view === 'force-change-password') return <ForcePasswordChange onNavigate={handleNavigate} />;
  if (view === 'setup-2fa') return <TwoFactorSetup onLogin={handleLogin} onNavigate={handleNavigate} />;
  if (view === 'reset-password') return <ResetPassword onNavigate={handleNavigate} />;
  if (isAuthenticated && view === 'dashboard') {
    return (
      <>
        <IdleTimer onIdle={() => {
          alert('Session expired due to inactivity.');
          handleLogout();
        }} />
        <MainLayout user={user} onLogout={handleLogout} onNavigate={handleNavigate} />
      </>
    );
  }

  return <Welcome onNavigate={handleNavigate} />;
}

export default App;