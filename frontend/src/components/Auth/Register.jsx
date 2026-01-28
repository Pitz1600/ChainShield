import React, { useState } from 'react';
import '../../styles/Register.css';
import api from '../../services/api';

function Register({ onRegister, onNavigate }) {
  const [formData, setFormData] = useState({
    username: '',
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
      if (!formData.username || !formData.email) {
        setError('Please fill in all required fields');
        return;
      }
      if (formData.role === 'barangay_official') {
        if (!formData.position) {
          setError('Please select a position');
          return;
        }
        if (formData.position === 'Others' && !formData.customPosition) {
          setError('Please specify your position');
          return;
        }
      }
      setStep(2);
      return;
    }

    if (step === 2) {
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
        const finalPosition = formData.position === 'Others' ? formData.customPosition : formData.position;

        const res = await api.post('/auth/register', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          role: formData.role,
          position: formData.role === 'barangay_official' ? finalPosition : undefined
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
            <div className="sidebar-logo">🛡️</div>
            <h2 className="sidebar-title">ChainShield</h2>
            <p className="sidebar-subtitle">Document Fraud Detection</p>
          </div>

          <div className="sidebar-illustration">
            <div className="illustration-circle green"></div>
            <div className="illustration-icon">📝</div>
          </div>

          <div className="sidebar-info">
            <h3 className="sidebar-info-title">Join ChainShield</h3>
            <p className="sidebar-info-text">
              Create your account to access document verification tools and help protect government records.
            </p>

            <div className="role-info">
              <h4 className="role-info-title">Available Roles:</h4>
              <ul className="role-list">
                <li className="role-item">
                  <span className="role-icon">👤</span>
                  <div>
                    <strong>Resident</strong>
                    <span className="role-desc">Access to public services</span>
                  </div>
                </li>
                <li className="role-item">
                  <span className="role-icon">🔍</span>
                  <div>
                    <strong>Barangay Official</strong>
                    <span className="role-desc">Manage records and requests</span>
                  </div>
                </li>
                <li className="role-item">
                  <span className="role-icon">⚙️</span>
                  <div>
                    <strong>Administrator</strong>
                    <span className="role-desc">System configuration</span>
                  </div>
                </li>
              </ul>
            </div>
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
              <span className="alert-icon">⚠️</span>
              <span className="alert-message">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            {step === 1 && (
              <>
                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">👤</span>
                    <span>Full Name</span>
                    <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="field-input"
                    placeholder="Juan Dela Cruz"
                    required
                  />
                  <span className="field-hint">As it appears on official documents</span>
                </div>

                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">📧</span>
                    <span>Government Email</span>
                    <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="field-input"
                    placeholder="juan.delacruz@gov.ph"
                    required
                  />
                  <span className="field-hint">Official government email only</span>
                </div>

                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">👤</span>
                    <span>Role</span>
                    <span className="required">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="field-input"
                    required
                  >
                    <option value="resident">Resident</option>
                    <option value="barangay_official">Barangay Official</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <span className="field-hint">Select your access level</span>
                </div>

                {formData.role === 'barangay_official' && (
                  <>
                    <div className="form-field">
                      <label className="field-label">
                        <span className="label-icon">👔</span>
                        <span>Position</span>
                        <span className="required">*</span>
                      </label>
                      <select
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        className="field-input"
                        required
                      >
                        {['Captain', 'Secretary', 'Treasurer', 'Kagawad', 'SK Chairman', 'Others'].map(pos => (
                          <option key={pos} value={pos}>{pos}</option>
                        ))}
                      </select>
                      <span className="field-hint">Your official position</span>
                    </div>

                    {formData.position === 'Others' && (
                      <div className="form-field">
                        <label className="field-label">
                          <span>Specify Position</span>
                          <span className="required">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.customPosition}
                          onChange={(e) => setFormData({ ...formData, customPosition: e.target.value })}
                          className="field-input"
                          placeholder="Enter your position"
                          required
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">🔒</span>
                    <span>Password</span>
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
                    <span className="label-icon">🔐</span>
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
    </div>
  );
}

export default Register;