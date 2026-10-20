import '../../styles/AuthCentered.css';
import TextField from '../Forms/TextField';
import React, { useState, useRef } from 'react';
import CaptchaWidget from './CaptchaWidget';
import '../../styles/Register.css';
import api from '../../services/api';
import { apiFieldErrors } from '../../utils/fieldValidation';
import LegalPolicyModal from './LegalPolicyModal';

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
  const [legalPolicy, setLegalPolicy] = useState(null);

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
    <div className="auth-container auth-centered register-screen">
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
            <div className="registration-fields">
              {[
                { field: 'firstName', label: 'First Name', placeholder: 'Juan', autoComplete: 'given-name' },
                { field: 'lastName', label: 'Last Name', placeholder: 'Dela Cruz', autoComplete: 'family-name' },
                { field: 'email', label: 'Email Address', type: 'email', placeholder: 'juan.delacruz@example.com', autoComplete: 'email', hint: "We'll send a verification code to this email" },
                { field: 'birthday', label: 'Date of Birth', type: 'date', optional: true, autoComplete: 'bday', hint: 'Optional' },
              ].map(({ field, label, type = 'text', optional, hint, ...inputProps }) => (
                <div className="form-field" key={field}>
                  <label className="field-label" htmlFor={`register-${field}`}>{label}{!optional && <span className="required">*</span>}</label>
                  <TextField {...inputProps} id={`register-${field}`} name={field} field={field} type={type}
                    error={fieldErrors[field]} onEdit={() => setFieldErrors({})}
                    value={formData[field]} onChange={event => setFormData({ ...formData, [field]: event.target.value })}
                    className="field-input" required={!optional}
                    max={type === 'date' ? new Date().toISOString().split('T')[0] : undefined} />
                  {hint && <span className="field-hint">{hint}</span>}
                </div>
              ))}
              <div className="form-field">
                <label className="field-label" htmlFor="register-role">Requested role<span className="required">*</span></label>
                <TextField id="register-role" name="role" field="role" as="select" className="field-input" required
                  error={fieldErrors.role} onEdit={() => setFieldErrors({})}
                  value={formData.role} onChange={event => setFormData({ ...formData, role: event.target.value })}>
                  <option value="barangay_official">Barangay Official</option>
                  <option value="auditor">Auditor</option>
                </TextField>
              </div>
              <div className="form-field">
                <label className="field-label" htmlFor="register-position">Position<span className="required">*</span></label>
                <TextField id="register-position" name="position" field="position" className="field-input" autoComplete="organization-title" required
                  error={fieldErrors.position} onEdit={() => setFieldErrors({})}
                  value={formData.position} onChange={event => setFormData({ ...formData, position: event.target.value })} />
              </div>
              {[
                { field: 'password', label: 'Password', placeholder: 'Create a strong password', hint: 'Minimum 8 characters with uppercase, lowercase, number, and special character' },
                { field: 'confirmPassword', label: 'Confirm Password', placeholder: 'Re-enter your password', hint: 'Must match the password above' },
              ].map(({ field, label, placeholder, hint }) => (
                <div className="form-field" key={field}>
                  <label className="field-label" htmlFor={`register-${field}`}>{label}<span className="required">*</span></label>
                  <div className="password-control">
                    <TextField id={`register-${field}`} name={field} field={field} type={visiblePasswords[field] ? 'text' : 'password'}
                      autoComplete="new-password" error={fieldErrors[field]} onEdit={() => setFieldErrors({})}
                      value={formData[field]} onChange={event => setFormData({ ...formData, [field]: event.target.value })}
                      className="field-input" placeholder={placeholder} required />
                    <button type="button" aria-label={`${visiblePasswords[field] ? 'Hide' : 'Show'} ${field === 'password' ? 'password' : 'confirmation password'}`}
                      aria-pressed={Boolean(visiblePasswords[field])}
                      onClick={() => setVisiblePasswords(previous => ({ ...previous, [field]: !previous[field] }))}>
                      {visiblePasswords[field] ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <span className="field-hint">{hint}</span>
                </div>
              ))}
            </div>
            <div className="terms-box">
              <div className="checkbox-label">
                <input id="register-terms" type="checkbox" className="checkbox-input" required aria-label="I agree to the Terms of Service and Privacy Policy" />
                <span><label htmlFor="register-terms">I agree to the </label><button type="button" className="legal-policy-link" onClick={() => setLegalPolicy('terms')}>Terms of Service</button> and <button type="button" className="legal-policy-link" onClick={() => setLegalPolicy('privacy')}>Privacy Policy</button></span>
              </div>
            </div>
            <CaptchaWidget ref={captchaRef} action="register" onToken={setCaptchaToken} />
            {error && <p className="field-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading || (captchaEnabled && !captchaToken)} className="submit-button">
              {loading ? <><span className="spinner" /><span>Creating Account...</span></> : <><span>Create Account</span><span className="button-icon">→</span></>}
            </button>
          </form>
          <p className="registration-approval-note">Verify your email after registering. An administrator must approve your account before you can access the portal.</p>

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
      {legalPolicy && <LegalPolicyModal policy={legalPolicy} onClose={() => setLegalPolicy(null)} />}
    </div >
  );
}

export default Register;
