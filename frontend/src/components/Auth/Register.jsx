import TextField from '../Forms/TextField';
import React, { useState, useRef } from 'react';
import { Shield, User, Mail, Lock, AlertCircle, Building, Calendar, FileText, ShieldCheck } from 'lucide-react';
import CaptchaWidget from './CaptchaWidget';
import '../../styles/Register.css';
import api from '../../services/api';
import { apiFieldErrors } from '../../utils/fieldValidation';

function Register({ onNavigate }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    role: 'barangay_official',
    position: 'Kagawad',
    customPosition: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef(null);
  const captchaEnabled = import.meta.env.VITE_CAPTCHA_ENABLED === 'true';
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    setFieldErrors({});
    if (loading) return;
    {
      const passwordError = message => {
        setFieldErrors({ password: message });
        requestAnimationFrame(() => document.querySelector('[data-field="password"]')?.focus());
      };
      // Strong password validation
      if (formData.password.length < 8) {
        passwordError('Password must be at least 8 characters');
        return;
      }
      if (!/[a-z]/.test(formData.password)) {
        passwordError('Password must contain at least one lowercase letter');
        return;
      }
      if (!/[A-Z]/.test(formData.password)) {
        passwordError('Password must contain at least one uppercase letter');
        return;
      }
      if (!/[0-9]/.test(formData.password)) {
        passwordError('Password must contain at least one number');
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        passwordError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFieldErrors({ confirmPassword: 'Passwords do not match' });
        document.querySelector('[data-field="confirmPassword"]')?.focus();
        return;
      }

      if (captchaEnabled && !captchaToken) { setError('Please complete the security check.'); return; }
      setLoading(true);
      try {
        const res = await api.post('/auth/register', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          birthday: formData.birthday || null,
          email: formData.email,
          password: formData.password,
          captchaToken,
          role: formData.role,
          position: formData.position
        });

        // Navigate to email verification
        onNavigate('email-verify', res.data.user);

      } catch (err) {
        setFieldErrors(apiFieldErrors(err));
        setError(err.response?.data?.error || 'Registration failed. Please try again.');
        requestAnimationFrame(() => document.querySelector('[aria-invalid="true"]')?.focus());
      } finally {
        captchaRef.current?.reset();
        setCaptchaToken('');
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar register-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><img src="/ChainShield_logo.png" alt="ChainShield Logo" className="logo-image" /></div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Transaction Verification System</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle green"></div>
            <div className="illustration-icon"><FileText size={48} color="white" /></div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Join ChainShield</h3>
            <p className="sidebar-info-text">
              Officials and auditors can register. Email verification and administrator approval are required.
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
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Complete your details to request an account</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {(
              <>
                <div className="form-field">
                  <label className="field-label">

                    <span>First Name</span>
                    <span className="required">*</span>
                  </label>
                  <TextField error={fieldErrors.firstName} onEdit={() => setFieldErrors({})} field="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="field-input"
                    placeholder="Juan"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">

                    <span>Last Name</span>
                    <span className="required">*</span>
                  </label>
                  <TextField error={fieldErrors.lastName} onEdit={() => setFieldErrors({})} field="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="field-input"
                    placeholder="Dela Cruz"
                    required
                  />
                </div>

                <div className="form-field">
                  <label className="field-label">

                    <span>Date of Birth</span>
                  </label>
                  <TextField error={fieldErrors.birthday} onEdit={() => setFieldErrors({})} field="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="field-input"
                    max={new Date().toISOString().split('T')[0]}
                  />
                  <span className="field-hint">Optional - for age verification</span>
                </div>

                <div className="form-field">
                  <label className="field-label">

                    <span>Email Address</span>
                    <span className="required">*</span>
                  </label>
                  <TextField field="email" error={fieldErrors.email} onEdit={() => setFieldErrors({})}
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="field-input"
                    placeholder="juan.delacruz@example.com"
                    required
                  />
                  <span className="field-hint">We'll send a verification code to this email</span>
                </div>


              </>
            )}

            {<>
              <label className="field-label">Requested role</label>
              <TextField error={fieldErrors.role} onEdit={() => setFieldErrors({})} field="role" as="select" className="field-input" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                <option value="barangay_official">Barangay Official</option><option value="auditor">Auditor</option>
              </TextField>
              <label className="field-label">Position *</label>
              <TextField error={fieldErrors.position} onEdit={() => setFieldErrors({})} field="position" className="field-input" required value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} />
            </>}
            {(
              <>
                <div className="form-field">
                  <label className="field-label">

                    <span>Password</span>
                  </label>
                  <div className="password-control"><TextField error={fieldErrors.password} onEdit={() => setFieldErrors({})} field="password"
                    type={visiblePasswords.password ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="field-input"
                    placeholder="Create a strong password"
                    required
                  /><button type="button" aria-label={`${visiblePasswords.password ? 'Hide' : 'Show'} password`} aria-pressed={Boolean(visiblePasswords.password)} onClick={() => setVisiblePasswords(previous => ({ ...previous, password: !previous.password }))}>{visiblePasswords.password ? 'Hide' : 'Show'}</button></div>
                  <span className="field-hint">Minimum 8 characters with uppercase, lowercase, number, and special character</span>
                </div>

                <div className="form-field">
                  <label className="field-label">

                    <span>Confirm Password</span>
                    <span className="required">*</span>
                  </label>
                  <div className="password-control"><TextField error={fieldErrors.confirmPassword} onEdit={() => setFieldErrors({})} field="confirmPassword"
                    type={visiblePasswords.confirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="field-input"
                    placeholder="Re-enter your password"
                    required
                  /><button type="button" aria-label={`${visiblePasswords.confirmPassword ? 'Hide' : 'Show'} confirmation password`} aria-pressed={Boolean(visiblePasswords.confirmPassword)} onClick={() => setVisiblePasswords(previous => ({ ...previous, confirmPassword: !previous.confirmPassword }))}>{visiblePasswords.confirmPassword ? 'Hide' : 'Show'}</button></div>
                  <span className="field-hint">Must match the password above</span>
                </div>

                <div className="terms-box">
                  <label className="checkbox-label">
                    <input type="checkbox" className="checkbox-input" required />
                    <span>
                      I agree to the <a href="#" className="link-text">Terms of Service</a> and{' '}
                      <a href="#" className="link-text">Privacy Policy</a>
                    </span>
                  </label>
                </div>
              </>
            )}

            {<CaptchaWidget ref={captchaRef} action="register" onToken={setCaptchaToken} />}
            {error && <p className="field-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading || (captchaEnabled && !captchaToken)} className="submit-button">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <span className="button-icon">→</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p className="footer-text">
              Already have an account?{' '}
              <button className="link-button" onClick={() => onNavigate('login')}>
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div >
  );
}

export default Register;
