import React, { useState } from 'react';
import '../../styles/Register.css';

function Register({ onRegister, onNavigate }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    department: '',
    role: 'analyst',
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
      if (!formData.username || !formData.email || !formData.department) {
        setError('Please fill in all required fields');
        return;
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
        const mockUser = {
          id: Date.now().toString(),
          username: formData.username,
          email: formData.email,
          role: formData.role,
          department: formData.department
        };
        setTimeout(() => {
          onRegister('mock-token-' + Date.now(), mockUser);
        }, 1500);
      } catch (err) {
        setError('Registration failed. Please try again.');
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
                    <strong>Analyst</strong>
                    <span className="role-desc">View and analyze document alerts</span>
                  </div>
                </li>
                <li className="role-item">
                  <span className="role-icon">🔍</span>
                  <div>
                    <strong>Investigator</strong>
                    <span className="role-desc">Manage fraud cases</span>
                  </div>
                </li>
                <li className="role-item">
                  <span className="role-icon">⚙️</span>
                  <div>
                    <strong>Administrator</strong>
                    <span className="role-desc">Full system access</span>
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
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="field-input"
                    placeholder="juan.delacruz@gov.ph"
                    required
                  />
                  <span className="field-hint">Official government email only</span>
                </div>

                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">🏢</span>
                    <span>Department/Agency</span>
                    <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({...formData, department: e.target.value})}
                    className="field-input"
                    placeholder="e.g., Document Verification Unit, LTO, NSO"
                    required
                  />
                  <span className="field-hint">Your organizational unit</span>
                </div>

                <div className="form-field">
                  <label className="field-label">
                    <span className="label-icon">🎯</span>
                    <span>Role</span>
                    <span className="required">*</span>
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="field-input"
                    required
                  >
                    <option value="analyst">Analyst - View and analyze fraud alerts</option>
                    <option value="investigator">Investigator - Manage cases and investigations</option>
                    <option value="admin">Administrator - Full system access</option>
                    <option value="viewer">Viewer - Read-only access</option>
                  </select>
                  <span className="field-hint">Select your access level</span>
                </div>
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
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
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