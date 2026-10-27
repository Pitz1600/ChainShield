import '../../styles/AuthCentered.css';
import useFieldErrors from '../../utils/useFieldErrors';
import { apiFieldErrors } from '../../utils/fieldValidation';
import TextField from '../Forms/TextField';
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Smartphone, Key, Send } from 'lucide-react';
import CaptchaWidget from './CaptchaWidget';
import '../../styles/Login.css';
import { authAPI } from '../../services/api';

function Login({ onLogin, onNavigate }) {
  const [fieldErrors, setFieldErrors] = useFieldErrors();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef(null);
  const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED === 'true';

  // Multi-step login state
  const [step, setStep] = useState('credentials'); // credentials | totp | otp | rememberDevice
  const [totpCode, setTotpCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [userId, setUserId] = useState(null);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

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

  useEffect(() => {
    let timer;
    if (lockoutSeconds > 0) {
      timer = setInterval(() => {
        setLockoutSeconds((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = Math.max(totalSeconds % 60, 0);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setLockoutSeconds(0);

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

      if (captchaEnabled && !captchaToken) { setError('Please complete the security check.'); return; }
      const payload = {
        email: String(formData.email || '').trim().toLowerCase(),
        password: String(formData.password || '').trim(),
        captchaToken
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
      const validationErrors = apiFieldErrors(err);
      if (err.response?.status === 401 && !err.response?.data?.retryAfterSeconds) {
        const message = err.response?.data?.error || 'Check your credentials.';
        setFieldErrors(step === 'totp' ? { totpCode: message } : { email: message, password: message });
      } else setFieldErrors(validationErrors);
      if (err.response?.status === 429) {
        const retryAfterHeader = err.response.headers?.['ratelimit-reset'] || err.response.headers?.['retry-after'];
        const bodySeconds = err.response.data?.retryAfterSeconds;
        const seconds = bodySeconds ?? (retryAfterHeader ? Number(retryAfterHeader) : 0);
        if (seconds && !Number.isNaN(seconds)) setRateLimitSeconds(seconds);
        setError(err.response?.data?.error || 'Too many attempts. Please wait.');
      } else if (err.response?.status === 401 && err.response?.data?.retryAfterSeconds) {
        const seconds = Number(err.response.data.retryAfterSeconds);
        if (seconds && !Number.isNaN(seconds)) setLockoutSeconds(seconds);
        setError(err.response?.data?.error || 'Account is temporarily locked.');
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Login failed. Please check your credentials or server status.');
      }
    } finally {
      if (!(step === 'totp' && !formData.password)) {
        captchaRef.current?.reset();
        setCaptchaToken('');
      }
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
      setFieldErrors(apiFieldErrors(err));
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
      setFieldErrors(apiFieldErrors(err));
      setError(err.response?.data?.error || 'Failed to resend code. Please try again.');
    }
  };

  const renderTotpStep = () => (
    <form onSubmit={handleSubmit} className="auth-form">
      <div className="security-badge">

        <span>Two-Factor Authentication Required</span>
      </div>

      <div className="form-field">
        <label className="field-label">

          <span>Authenticator Code</span>
        </label>
        <TextField error={fieldErrors["totpCode"]} onEdit={() => setFieldErrors({})} field="totpCode"
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

      {formData.password && <CaptchaWidget key="totp" ref={captchaRef} action="login" onToken={setCaptchaToken} />}
      {alertMessage && <p className="field-error" role="alert">{alertMessage}</p>}
      <button type="submit" disabled={loading || totpCode.length < 6 || (Boolean(formData.password) && captchaEnabled && !captchaToken)} className="submit-button">
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

        <span>New Device Detected</span>
      </div>
      <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        A verification code has been sent to your email.
      </p>

      <div className="form-field">
        <label className="field-label">

          <span>Email Verification Code</span>
        </label>
        <TextField error={fieldErrors["otpCode"]} onEdit={() => setFieldErrors({})} field="otpCode"
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

      {alertMessage && <p className="field-error" role="alert">{alertMessage}</p>}
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

          <span>Email Address</span>
        </label>
        <TextField error={fieldErrors["email"]} onEdit={() => setFieldErrors({})} field="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="field-input"
          placeholder="your.email@example.com"
          required
        />
        <span className="field-hint">Enter your account email address. Accounts are created by the Municipal DILG Officer (administrator).</span>
      </div>

      <div className="form-field">
        <label className="field-label">

          <span>Password</span>
        </label>
        <div className="password-control">
          <TextField error={fieldErrors["password"]} onEdit={() => setFieldErrors({})} field="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="field-input"
            placeholder="Enter your password"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword(previous => !previous)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
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

      <CaptchaWidget key="credentials" ref={captchaRef} action="login" onToken={setCaptchaToken} />
      {alertMessage && <p className="field-error" role="alert">{alertMessage}</p>}
      <button type="submit" disabled={loading || (captchaEnabled && !captchaToken)} className="submit-button">
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
  );

  const lockCountdown = lockoutSeconds || rateLimitSeconds;
  const alertMessage = lockCountdown > 0
    ? `Account locked. Try again in ${formatCountdown(lockCountdown)}.`
    : error;

  return (
    <div className="auth-container auth-centered login-screen">
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

      {step === 'credentials' && renderCredentialsStep()}
      {step === 'totp' && renderTotpStep()}
      {step === 'otp' && renderOtpStep()}



        </div>
      </div>
    </div>
  );
}

export default Login;
