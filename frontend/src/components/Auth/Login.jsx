import React, { useState } from 'react';
import { Shield, Lock, Mail, AlertCircle, Info, ArrowRight } from 'lucide-react';
import '../../styles/Login.css';
import api from '../../services/api';

function Login({ onLogin, onNavigate }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        // Successful login
        onLogin(data.token, data.user);
      } else {
        // Login failed
        setError(data.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('Unable to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><img src="/ChainShield_logo.png" alt="ChainShield Logo" className="logo-image" /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle"></div>
            <div className="illustration-icon"><Lock size={64} /></div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Secure Access</h3>
            <p className="sidebar-info-text">
              Sign in to access authorized digital services and monitor system activity.
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
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label className="field-label">
                <span className="label-icon"><Mail size={18} /></span>
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="field-input"
                placeholder="your.email@example.com"
                required
              />
              <span className="field-hint">Enter your registered email address</span>
            </div>

            <div className="form-field">
              <label className="field-label">
                <span className="label-icon"><Lock size={18} /></span>
                <span>Password</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                  <span className="button-icon"><ArrowRight size={18} /></span>
                </>
              )}
            </button>
          </form>

          <div className="demo-credentials">
            <div className="demo-header">
              <span className="demo-icon"><Info size={18} /></span>
              <span className="demo-title">Demo Credentials</span>
            </div>
            <div className="demo-info">
              <code className="demo-code">admin@chainshield.local</code>
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