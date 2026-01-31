import React, { useState } from 'react';
import { Shield, Lock, AlertCircle, Info } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import '../../styles/NewPassword.css';

function NewPassword({ resetToken, userEmail, onNavigate, onPasswordReset }) {
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/new-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resetToken,
          email: userEmail,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Redirect to login after successful password reset
        setTimeout(() => {
          onPasswordReset();
          onNavigate('login');
        }, 2000);
      } else {
        setError(data.error || 'Failed to reset password. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar new-password-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><Shield size={48} /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle teal"></div>
            <div className="illustration-icon">🔐</div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Create New Password</h3>
            <p className="sidebar-info-text">
              Choose a strong password to secure your account. Make sure it's at least 6 characters long.
            </p>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate('login')}>
            ← Back to Sign In
          </button>

          <div className="auth-header">
            <h1 className="auth-title">Create New Password</h1>
            <p className="auth-subtitle">
              Enter your new password below to complete the reset process.
            </p>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          {success && (
            <div className="alert-box success">
              <span className="alert-icon">✓</span>
              <span className="alert-message">
                Password reset successfully! Redirecting to sign in...
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label className="field-label">
                <span className="label-icon">🔒</span>
                <span>New Password</span>
                <span className="required">*</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="field-input"
                placeholder="Create a strong password"
                required
              />
              <span className="field-hint">Minimum 6 characters, include letters and numbers</span>
            </div>

            <div className="form-field">
              <label className="field-label">
                <span className="label-icon">🔓</span>
                <span>Confirm New Password</span>
                <span className="required">*</span>
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="field-input"
                placeholder="Re-enter your password"
                required
              />
              <span className="field-hint">Must match the password above</span>
            </div>

            <div className="password-requirements">
              <div className="requirements-header">
                <span className="requirements-icon"><Info size={18} /></span>
                <span className="requirements-title">Password Requirements:</span>
              </div>
              <ul className="requirements-list">
                <li className={formData.password.length >= 6 ? 'met' : ''}>
                  At least 6 characters long
                </li>
                <li className={/[A-Za-z]/.test(formData.password) ? 'met' : ''}>
                  Contains letters
                </li>
                <li className={/[0-9]/.test(formData.password) ? 'met' : ''}>
                  Contains numbers
                </li>
                <li className={formData.password === formData.confirmPassword && formData.password !== '' ? 'met' : ''}>
                  Passwords match
                </li>
              </ul>
            </div>

            <button type="submit" disabled={loading || success} className="submit-button">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Resetting Password...</span>
                </>
              ) : success ? (
                <>
                  <span>Password Reset!</span>
                  <span className="button-icon">✓</span>
                </>
              ) : (
                <>
                  <span>Reset Password</span>
                  <span className="button-icon">→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p className="footer-text">
              Remember your password?{' '}
              <button className="link-button" onClick={() => onNavigate('login')}>
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewPassword;