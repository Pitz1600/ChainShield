import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null); // Authenticated user
  const [pendingUser, setPendingUser] = useState(null); // User for verification
  const [isLoading, setIsLoading] = useState(true);

  const routeForView = useCallback((view) => {
    switch (view) {
      case 'welcome': return '/welcome';
      case 'login': return '/login';
      case 'register': return '/register';
      case 'email-verify': return '/email-verify';
      case 'force-change-password': return '/force-change-password';
      case 'setup-2fa': return '/setup-2fa';
      case 'reset-password':
      case 'forgot-password':
        return '/reset-password';
      case 'dashboard': return '/dashboard';
      case 'transactions': return '/dashboard/transactions';
      case 'analytics': return '/dashboard/analytics';
      case 'integrity_checker': return '/dashboard/integrity-checker';
      case 'admin': return '/dashboard/admin';
      case 'feedbacks': return '/dashboard/feedbacks';
      case 'profile': return '/dashboard/profile';
      default: return '/welcome';
    }
  }, []);

  const navigateTo = useCallback((path, opts = { replace: true }) => {
    if (window.location.pathname !== path) {
      navigate(path, opts);
    }
  }, [navigate]);

  useEffect(() => {
    // Check for existing authentication on mount via API (cookie)
    const checkAuth = async () => {
      try {
        const response = await authAPI.getProfile();
        const userData = response.data;

        if (userData.mustChangePassword) {
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          setPendingUser(userData);
          navigateTo('/force-change-password');
        } else if (userData.mustSetup2FA || (userData.role === 'administrator' && !userData.twoFactorEnabled)) {
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          setPendingUser(userData);
          navigateTo('/setup-2fa');
        } else if (!userData.isVerified) {
          setIsAuthenticated(false);
          localStorage.removeItem('user');
          setPendingUser(userData);
          navigateTo('/email-verify');
        } else {
          setIsAuthenticated(true);
          setUser(userData);
          const currentPath = window.location.pathname || '';
          const isAuthPath = [
            '/',
            '/welcome',
            '/login',
            '/register',
            '/email-verify',
            '/force-change-password',
            '/setup-2fa',
            '/reset-password'
          ].includes(currentPath);
          if (isAuthPath) {
            navigateTo('/dashboard');
          }
        }
      } catch (error) {
        // Not authenticated or session expired
        const currentPath = window.location.pathname || '';
        if (currentPath.startsWith('/dashboard')) {
          navigateTo('/login');
        } else if (currentPath === '/' || currentPath === '') {
          navigateTo('/welcome');
        }
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [navigateTo]);

  const handleLogin = useCallback((token, userData) => {
    const userObj = userData || token;
    localStorage.setItem('user', JSON.stringify(userObj));
    setIsAuthenticated(true);
    setUser(userObj);
    navigateTo('/dashboard', { replace: true });
  }, [navigateTo]);

  const handleLogout = async () => {
    try {
      // Call logout API to invalidate token on backend and clear cookies
      await authAPI.logout();
      console.log('[Logout] Backend logout successful');
    } catch (err) {
      console.error('[Logout] API call failed:', err.message);
      // Continue with logout even if API call fails
    }

    // Clear all frontend auth state immediately
    localStorage.removeItem('user');
    sessionStorage.clear();
    setIsAuthenticated(false);
    setUser(null);
    setPendingUser(null);

    // Navigate to welcome view
    navigateTo('/welcome');

    // NOTE: Don't verify token is blacklisted here - the response interceptor
    // would redirect us back to /setup-2fa if token is invalid (403 + onboardingRequired)
    // Let logout complete cleanly by not making any authenticated requests
  };

  const handleNavigate = useCallback((newView, data = null) => {
    if (data) {
      setPendingUser(data);
    }
    navigateTo(routeForView(newView), { replace: false });
  }, [navigateTo, routeForView]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div style={{ width: '50px', height: '50px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.875rem' }}>Verifying System Integrity...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/welcome'} replace />} />
      <Route path="/welcome" element={<Welcome onNavigate={handleNavigate} />} />
      <Route path="/login" element={<Login onLogin={handleLogin} onNavigate={handleNavigate} />} />
      <Route path="/register" element={<Register onRegister={handleLogin} onNavigate={handleNavigate} />} />
      <Route path="/email-verify" element={<EmailVerify user={pendingUser} onNavigate={handleNavigate} onLogin={handleLogin} />} />
      <Route path="/force-change-password" element={<ForcePasswordChange onNavigate={handleNavigate} onLogout={handleLogout} />} />
      <Route path="/setup-2fa" element={<TwoFactorSetup onLogin={handleLogin} onNavigate={handleNavigate} onLogout={handleLogout} />} />
      <Route path="/reset-password" element={<ResetPassword onNavigate={handleNavigate} />} />
      <Route
        path="/dashboard/*"
        element={
          isAuthenticated ? (
            <>
              <IdleTimer onIdle={() => {
                alert('Session expired due to inactivity.');
                handleLogout();
              }} />
              <MainLayout user={user} onLogout={handleLogout} onNavigate={handleNavigate} />
            </>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/welcome'} replace />} />
    </Routes>
  );
}

export default App;
