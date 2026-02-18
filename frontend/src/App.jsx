import React, { useState, useEffect, useCallback } from 'react';
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
    // Check for existing authentication on mount via API (cookie)
    const checkAuth = async () => {
      try {
        // If there are OAuth result params in the URL, let Login.jsx handle them.
        // Don't auto-login — the user may have cancelled OAuth or the flow may have failed.
        const params = new URLSearchParams(window.location.search);
        const hasOauthParams = params.get('error') ||
          params.get('oauth') === 'success' ||
          params.get('oauth_mfa') ||
          params.get('oauth_setup_2fa') ||
          params.get('oauth_force_password');

        if (hasOauthParams) {
          setView('login');
          setIsLoading(false);
          return;
        }

        const response = await authAPI.getProfile();
        const userData = response.data;

        if (userData.mustChangePassword) {
          setPendingUser(userData);
          setView('force-change-password');
        } else if (userData.mustSetup2FA || (userData.role === 'administrator' && !userData.twoFactorEnabled)) {
          setPendingUser(userData);
          setView('setup-2fa');
        } else if (!userData.isVerified) {
          setPendingUser(userData);
          setView('email-verify');
        } else {
          setIsAuthenticated(true);
          setUser(userData);
          setView('dashboard');
        }
      } catch (error) {
        // Not authenticated or session expired
        setView('welcome');
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogin = useCallback((token, userData) => {
    const userObj = userData || token;
    localStorage.setItem('user', JSON.stringify(userObj));
    setIsAuthenticated(true);
    setUser(userObj);
    setView('dashboard');
  }, []);

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch { }
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setPendingUser(null);
    setView('welcome');
  };

  const handleNavigate = useCallback((newView, data = null) => {
    if (data) {
      setPendingUser(data);
    }
    setView(newView);
  }, []);

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
  if (view === 'force-change-password') return <ForcePasswordChange onNavigate={handleNavigate} onLogout={handleLogout} />;
  if (view === 'setup-2fa') return <TwoFactorSetup onLogin={handleLogin} onNavigate={handleNavigate} onLogout={handleLogout} />;
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