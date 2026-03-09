import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Smartphone, Key, Send } from 'lucide-react';
import '../../styles/Login.css';
import { authAPI } from '../../services/api';

// Google icon SVG (inline, no external dependency)
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
    <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
  </svg>
);

function Login({ onLogin, onNavigate }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Multi-step login state
  const [step, setStep] = useState('credentials'); // credentials | totp | otp | rememberDevice
  const [totpCode, setTotpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  // Handle OAuth redirect result (?oauth=success or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthResult = params.get('oauth');
    const oauthError = params.get('error');
    const oauthMfa = params.get('oauth_mfa');
    const oauthSetup2FA = params.get('oauth_setup_2fa');
    const oauthForcePassword = params.get('oauth_force_password');
    const oauthUserId = params.get('userId');

    if (oauthMfa === 'true' && oauthUserId) {
      setStep('totp');
      setUserId(oauthUserId);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthSetup2FA === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      onNavigate('setup-2fa');
    } else if (oauthForcePassword === 'true') {
      window.history.replaceState({}, '', window.location.pathname);
      onNavigate('force-change-password');
    } else if (oauthResult === 'success') {
      // OAuth succeeded — fetch profile and complete login
      window.history.replaceState({}, '', window.location.pathname);
      authAPI.getProfile()
        .then(res => { if (res.data) onLogin(null, res.data); })
        .catch(() => setError('OAuth login failed. Please try again.'));
    } else if (oauthError) {
      window.history.replaceState({}, '', window.location.pathname);
      // Clear any stale session cookie so the user isn't silently logged in
      authAPI.logout().catch(() => { }); // fire-and-forget, ignore errors
      const errorMessages = {
        oauth_failed: 'Google sign-in was cancelled or failed. Please try again.',
        oauth_no_email: 'Google account has no email address. Please use a different account.',
        oauth_admin_blocked: 'Administrator accounts must sign in with email and password.',
        account_disabled: 'Your account has been disabled. Please contact support.',
        oauth_error: 'An error occurred during sign-in. Please try again.',
      };
      setError(errorMessages[oauthError] || 'Sign-in failed. Please try again.');
    }
  }, [onLogin]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    let timer;
    if (rateLimitSeconds > 0) {
      timer = setInterval(() => {
        setRateLimitSeconds((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [rateLimitSeconds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If it's the TOTP step during OAuth, use the dedicated verifyMfa endpoint
      if (step === 'totp' && !formData.password) {
        const response = await authAPI.verifyMfa({
          totpCode,
          rememberDevice
        });
        if (response.data.user) {
          onLogin(null, response.data.user);
        }
        return;
      }

      const payload = {
        email: String(formData.email || '').trim().toLowerCase(),
        password: String(formData.password || '').trim()
      };

      // Include TOTP code if on that step
      if (step === 'totp') {
        payload.totpCode = totpCode;
        payload.rememberDevice = rememberDevice;
      }

      const response = await authAPI.login(payload);
      const data = response.data;

      // Handle multi-step responses
      if (data.totpRequired) {
        setStep('totp');
        setUserId(data.userId);
      } else if (data.otpRequired) {
        setStep('otp');
        setUserId(data.userId);
        // Note: New device OTP usually means we hold the user data and navigate
        if (data.user) onNavigate('email-verify', data.user);
      } else if (data.mustChangePassword) {
        onNavigate('force-change-password');
      } else if (data.mustSetup2FA) {
        onNavigate('setup-2fa');
      } else {
        onLogin(null, data.user);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        const retryAfterHeader = err.response.headers?.['ratelimit-reset'] || err.response.headers?.['retry-after'];
        const bodySeconds = err.response.data?.retryAfterSeconds;
        const seconds = bodySeconds ?? (retryAfterHeader ? Number(retryAfterHeader) : 0);
        if (seconds && !Number.isNaN(seconds)) setRateLimitSeconds(seconds);
        setError(err.response?.data?.error || 'Too many attempts. Please wait.');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Login failed. Please check your credentials or server status.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.verifyLoginOtp({
        userId,
        otp: otpCode,
        rememberDevice
      });
      const data = response.data;

      if (data.mustSetup2FA) {
        localStorage.setItem('token', data.token);
        onNavigate('setup-2fa');
        return;
      }

      if (data.user) {
        onLogin(null, data.user);
      }
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');

    try {
      await authAPI.resendLoginOtp({ userId });
      setResendCooldown(60);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    }
  };

  const renderTotpStep = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="security-badge">
        <Smartphone size={24} />
        <span>Two-Factor Authentication Required</span>
      </div>

      <div className="form-field">
        <label className="field-label">
          <span className="label-icon"><Key size={18} /></span>
          <span>Authenticator Code</span>
        </label>
        <input
          type="text"
          value={totpCode}
          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="field-input otp-input"
          placeholder="Enter 6-digit code"
          autoFocus
          maxLength={6}
          required
        />
        <span className="field-hint">Enter the code from your authenticator app, or a recovery code</span>
      </div>

      <div className="form-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Remember this device for 30 days</span>
        </label>
      </div>

      <button type="submit" disabled={loading || totpCode.length < 6} className="submit-button">
        {loading ? (
          <>
            <span className="spinner"></span>
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <span>Verify</span>
            <span className="button-icon"><ArrowRight size={18} /></span>
          </>
        )}
      </button>

      <button type="button" className="link-button" onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}>
        ← Back to login
      </button>
    </form>
  );

  const renderOtpStep = () => (
    <form onSubmit={handleOtpSubmit} className="auth-form">
      <div className="security-badge warning">
        <AlertCircle size={24} />
        <span>New Device Detected</span>
      </div>
      <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        A verification code has been sent to your email.
      </p>

      <div className="form-field">
        <label className="field-label">
          <span className="label-icon"><Mail size={18} /></span>
          <span>Email Verification Code</span>
        </label>
        <input
          type="text"
          value={otpCode}
          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="field-input otp-input"
          placeholder="Enter 6-digit code"
          autoFocus
          maxLength={6}
          required
        />
      </div>

      <div className="form-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Remember this device for 30 days</span>
        </label>
      </div>

      <button type="submit" disabled={loading || otpCode.length < 6} className="submit-button">
        {loading ? (
          <>
            <span className="spinner"></span>
            <span>Verifying...</span>
          </>
        ) : (
          <>
            <span>Verify</span>
            <span className="button-icon"><ArrowRight size={18} /></span>
          </>
        )}
      </button>

      <div className="resend-container" style={{ textAlign: 'center', marginTop: '1rem' }}>
        <p className="footer-text">
          Didn't receive the code?{' '}
          <button
            type="button"
            className="link-button"
            onClick={handleResendOtp}
            disabled={resendCooldown > 0}
            style={{ display: 'inline', width: 'auto', padding: 0, height: 'auto', background: 'none' }}
          >
            {resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend code'}
          </button>
        </p>
      </div>

      <button type="button" className="link-button" onClick={() => { setStep('credentials'); setError(''); setOtpCode(''); }}>
        ← Back to login
      </button>
    </form>
  );

  const renderCredentialsStep = () => (
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
        <span className="field-hint">Minimum 8 characters</span>
      </div>

      <div className="form-options">
        <label className="checkbox-label">
          <input
            type="checkbox"
            className="checkbox-input"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
          />
          <span>Remember me</span>
        </label>
        <button type="button" className="link-text" onClick={() => onNavigate('forgot-password')}>
          Forgot password?
        </button>
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

      {/* Google OAuth SSO Button */}
      <div className="oauth-divider">
        <span>or</span>
      </div>
      <a
        href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/auth/google`}
        className="oauth-button google-button"
        aria-label="Continue with Google"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </a>
    </form>
  );

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
              {step === 'totp'
                ? 'Enter the code from your authenticator app to verify your identity.'
                : step === 'otp'
                  ? 'A new device was detected. Please verify with the code sent to your email.'
                  : 'Sign in to access authorized digital services and monitor system activity.'}
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
            <h1 className="auth-title">
              {step === 'totp' ? 'Verify Identity' : step === 'otp' ? 'New Device' : 'Welcome Back'}
            </h1>
            <p className="auth-subtitle">
              {step === 'totp'
                ? 'Enter your authenticator code to continue'
                : step === 'otp'
                  ? 'Verify this device to continue'
                  : 'Sign in to continue to ChainShield Portal'}
            </p>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

      {step === 'credentials' && renderCredentialsStep()}
      {step === 'totp' && renderTotpStep()}
      {step === 'otp' && renderOtpStep()}
      {rateLimitSeconds > 0 && (
        <div className="alert-box info">
          <span className="alert-icon"><AlertCircle size={20} /></span>
          <span className="alert-message">
            Login locked for about {Math.ceil(rateLimitSeconds / 60)} minute(s). {rateLimitSeconds}s remaining.
          </span>
        </div>
      )}

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
