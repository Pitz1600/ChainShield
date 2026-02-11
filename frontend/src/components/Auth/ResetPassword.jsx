import React, { useState } from 'react';
import { Shield, Mail, AlertCircle, ChevronLeft, Check, ArrowRight, Key, Lightbulb } from 'lucide-react';
import '../../styles/ResetPassword.css';

function ResetPassword({ onNavigate, onResetRequest }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Pass the email to the parent and navigate to email verify
        setTimeout(() => {
          onResetRequest(email);
          onNavigate('email-verify', { email, type: 'reset' });
        }, 1500);
      } else {
        setError(data.error || 'Failed to send reset code. Please try again.');
      }
    } catch (err) {
      setError('Unable to connect to server. Please make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar reset-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><Shield size={48} /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle purple"></div>
            <div className="illustration-icon"><Key size={64} /></div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Reset Your Password</h3>
            <p className="sidebar-info-text">
              Enter your email address and we'll send you a verification code to reset your password securely.
            </p>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate('login')}>
            <ChevronLeft size={16} style={{ marginRight: '4px' }} /> Back to Sign In
          </button>

          <div className="auth-header">
            <h1 className="auth-title">Forgot Password?</h1>
            <p className="auth-subtitle">
              No worries! Enter your email address and we'll send you a code to reset your password.
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
                Reset code sent successfully! Redirecting to verification...
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-field">
              <label className="field-label">
                <span className="label-icon"><Mail size={16} /></span>
                <span>Email Address</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="your.email@example.com"
                required
              />
              <span className="field-hint">Enter the email associated with your account</span>
            </div>

            <button type="submit" disabled={loading || success} className="submit-button">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Sending Code...</span>
                </>
              ) : success ? (
                <>
                  <span>Code Sent!</span>
                  <span className="button-icon"><Check size={18} /></span>
                </>
              ) : (
                <>
                  <span>Send Reset Code</span>
                  <span className="button-icon"><ArrowRight size={18} /></span>
                </>
              )}
            </button>
          </form>

          <div className="help-section">
            <div className="help-header">
              <span className="help-icon"><Lightbulb size={18} /></span>
              <span className="help-title">What happens next?</span>
            </div>
            <ul className="help-list">
              <li>We'll send a 6-digit verification code to your email</li>
              <li>Enter the code on the next page to verify your identity</li>
              <li>Create a new password to secure your account</li>
            </ul>
          </div>

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

export default ResetPassword;