import React, { useState } from 'react';
import { Shield, User, Mail, Lock, AlertCircle, Building, Calendar, FileText, ShieldCheck } from 'lucide-react';
import '../../styles/Register.css';
import api from '../../services/api';

function Register({ onRegister, onNavigate }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    birthday: '',
    email: '',
    role: 'resident',
    position: 'Kagawad',
    customPosition: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (!formData.firstName || !formData.lastName || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      // Strong password validation
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
      if (!/[a-z]/.test(formData.password)) {
        setError('Password must contain at least one lowercase letter');
        return;
      }
      if (!/[A-Z]/.test(formData.password)) {
        setError('Password must contain at least one uppercase letter');
        return;
      }
      if (!/[0-9]/.test(formData.password)) {
        setError('Password must contain at least one number');
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
        setError('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }

      setLoading(true);
      try {
        const res = await api.post('/auth/register', {
          firstName: formData.firstName,
          lastName: formData.lastName,
          birthday: formData.birthday || null,
          email: formData.email,
          password: formData.password,
          role: 'resident'
        });

        // Save token for verification API calls
        localStorage.setItem('token', res.data.token);

        // Navigate to email verification
        onNavigate('email-verify', res.data.user);

      } catch (err) {
        setError(err.response?.data?.error || 'Registration failed. Please try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-sidebar register-sidebar">
        <div className="auth-sidebar-content">
          <div className="sidebar-brand" onClick={() => onNavigate('welcome')} style={{ cursor: 'pointer' }}>
            <div className="sidebar-logo"><Shield size={48} /></div>
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
              Create your account to access digital tools and help ensure system integrity.
            </p>


          </div>
        </div>
      </div>

      <div className="auth-main">
        <div className="auth-content">
          <button className="back-button" onClick={() => step === 1 ? onNavigate('welcome') : setStep(1)}>
            ← {step === 1 ? 'Back to Home' : 'Previous Step'}
          </button>

          <div className="auth-header">
            <h1 className="auth-title">Create Account</h1>
            <p className="auth-subtitle">Step {step} of 2 - {step === 1 ? 'Personal Information' : 'Security Setup'}</p>
          </div>

          <div className="progress-bar">
            <div className="progress-step completed">
              <div className="step-circle">1</div>
              <span className="step-label">Details</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step === 2 ? 'completed' : ''}`}>
              <div className="step-circle">2</div>
              <span className="step-label">Security</span>
            </div>
          </div>

          {error && (
            <div className="alert-box error">
              <span className="alert-icon"><AlertCircle size={20} /></span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {step === 1 && (
              <>
                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon"><User size={18} /></span>
                    <span>First Name</span>
                    <span className="required">*</span>
                  </label>
                  <input
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
                    <span className="label-icon"><User size={18} /></span>
                    <span>Last Name</span>
                    <span className="required">*</span>
                  </label>
                  <input
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
                    <span className="label-icon"><Calendar size={18} /></span>
                    <span>Date of Birth</span>
                  </label>
                  <input
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
                    <span className="label-icon"><Mail size={18} /></span>
                    <span>Email Address</span>
                    <span className="required">*</span>
                  </label>
                  <input
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

            {step === 2 && (
              <>
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
                    placeholder="Create a strong password"
                    required
                  />
                  <span className="field-hint">Minimum 8 characters with uppercase, lowercase, number, and special character</span>
                </div>

                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon"><ShieldCheck size={18} /></span>
                    <span>Confirm Password</span>
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

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? (
                <>
                  <span className="spinner"></span>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>{step === 1 ? 'Continue to Security' : 'Create Account'}</span>
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