import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import '../../styles/Login.css';
import { authAPI } from '../../services/api';

function ResetPassword({ onNavigate }) {
  const [step, setStep] = useState('request'); // request | reset | done
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.forgotPassword({ email });
      setSuccess(response.data.message || 'If an account exists with this email, a reset link has been sent.');
      setStep('reset');
    } catch (err) {
      // Always show generic message to prevent enumeration
      setSuccess('If an account exists with this email, a reset link has been sent.');
      setStep('reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const payload = { token, newPassword };
      if (totpCode) payload.totpCode = totpCode;

      await authAPI.resetPassword(payload);
      setStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Password reset failed. The token may be expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><Shield size={48} /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Account Recovery</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle"></div>
            <div className="illustration-icon"><Lock size={64} /></div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Reset Password</h3>
            <p className="sidebar-info-text">
              Enter your email to receive a password reset link. The link expires in 15 minutes.
            </p>
          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => onNavigate('login')}>
            ← Back to Login
          </button>

          <div className="auth-header">
            <h1 className="auth-title">
              {step === 'done' ? 'Password Reset' : step === 'reset' ? 'Enter Reset Token' : 'Forgot Password'}
            </h1>
            <p className="auth-subtitle">
              {step === 'done'
                ? 'Your password has been changed successfully.'
                : step === 'reset'
                  ? 'Enter the reset token from your email and your new password.'
                  : 'Enter your email to receive a reset link.'}
            </p>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          {success && step === 'reset' && (
            <div className="security-badge success">
              <CheckCircle size={20} />
              <span>{success}</span>
            </div>
          )}

          {step === 'request' && (
            <form onSubmit={handleRequestReset} className="auth-form">
              <div className="form-field">
                <label className="field-label">
                  <span className="label-icon"><Mail size={18} /></span>
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input"
                  placeholder="your.email@example.com"
                  required
                  autoFocus
                />
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <span className="button-icon"><ArrowRight size={18} /></span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="auth-form">
              <div className="form-field">
                <label className="field-label">
                  <span>Reset Token</span>
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="field-input"
                  placeholder="Paste the reset token from your email"
                  required
                  autoFocus
                />
              </div>

              <div className="form-field">
                <label className="field-label">
                  <span className="label-icon"><Lock size={18} /></span>
                  <span>New Password</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="field-input"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>

              <div className="form-field">
                <label className="field-label">
                  <span className="label-icon"><Lock size={18} /></span>
                  <span>Confirm Password</span>
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="field-input"
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <div className="form-field">
                <label className="field-label">
                  <span>2FA Code (if enabled)</span>
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="field-input otp-input"
                  placeholder="Optional — only if 2FA is enabled"
                  maxLength={6}
                />
                <span className="field-hint">Leave empty if you don't have 2FA enabled</span>
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <span className="button-icon"><ArrowRight size={18} /></span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'done' && (
            <div className="auth-form">
              <div className="security-badge success">
                <CheckCircle size={24} />
                <span>Password has been reset successfully!</span>
              </div>
              <p style={{ textAlign: 'center', color: '#6b7280', margin: '16px 0 24px' }}>
                You can now log in with your new password.
              </p>
              <button className="submit-button" onClick={() => onNavigate('login')}>
                <span>Go to Login</span>
                <span className="button-icon"><ArrowRight size={18} /></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;