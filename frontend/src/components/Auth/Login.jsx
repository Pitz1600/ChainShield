import React, { useState } from 'react';
import '../../styles/Login.css';

function Login({ onLogin, onNavigate }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Simulate API call
      if (formData.email && formData.password) {
        const mockUser = {
          id: '1',
          username: formData.email.split('@')[0],
          email: formData.email,
          role: 'admin',
          department: 'Anti-Fraud Unit'
        };
        setTimeout(() => {
          onLogin('mock-token-12345', mockUser);
        }, 1000);
      } else {
        setError('Please fill in all fields');
        setLoading(false);
      }
    } catch (err) {
      setError('Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo">🛡️</div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Government Fraud Detection</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle"></div>
            <div className="illustration-icon">🔐</div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Secure Access</h3>
            <p className="sidebar-info-text">
              Sign in to access fraud detection tools, investigate cases, and monitor suspicious transactions.
            </p>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate('welcome')}>
            ← Back to Home
          </button>

          <div className="auth-header">
            <h1 className="auth-title">Welcome Back</h1>
            <p className="auth-subtitle">Sign in to continue to ChainShield Portal</p>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon">⚠️</span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label className="field-label">
                <span className="label-icon">📧</span>
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="field-input"
                placeholder="your.email@gov.ph"
                required
              />
              <span className="field-hint">Use your government email address</span>
            </div>

            <div className="form-field">
              <label className="field-label">
                <span className="label-icon">🔒</span>
                <span>Password</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="field-input"
                placeholder="Enter your password"
                required
              />
              <span className="field-hint">Minimum 6 characters</span>
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input type="checkbox" className="checkbox-input" />
                <span>Remember me</span>
              </label>
              <a href="#" className="link-text">Forgot password?</a>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <span className="button-icon">→</span>
                </>
              )}
            </button>
          </form>

          <div className="demo-credentials">
            <div className="demo-header">
              <span className="demo-icon">ℹ️</span>
              <span className="demo-title">Demo Credentials</span>
            </div>
            <div className="demo-info">
              <code className="demo-code">admin@chainshield.gov</code>
              <code className="demo-code">admin123</code>
            </div>
          </div>

          <div className="auth-footer">
            <p className="footer-text">
              Don't have an account?{' '}
              <button className="link-button" onClick={() => onNavigate('register')}>
                Create Account
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;