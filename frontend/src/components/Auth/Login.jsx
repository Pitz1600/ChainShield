import React, { useState } from 'react';
import '../../styles/Login.css';

function Login({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    confirmPassword: '',
    role: 'analyst',
    department: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isRegisterMode) {
        if (formData.password !== formData.confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        setSuccess('Registration successful! You can now login.');
        setTimeout(() => {
          setIsRegisterMode(false);
          setFormData({ email: '', password: '', username: '', confirmPassword: '', role: 'analyst', department: '' });
          setSuccess('');
        }, 2000);
      } else {
        const mockUser = {
          id: '1',
          username: formData.email.split('@')[0],
          email: formData.email,
          role: 'admin',
          department: 'Anti-Fraud Unit'
        };
        onLogin('mock-token-12345', mockUser);
      }
    } catch (err) {
      setError(`${isRegisterMode ? 'Registration' : 'Login'} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-circle">🛡️</div>
          </div>
          <h1 className="login-title">ChainShield</h1>
          <p className="login-subtitle">Government Fraud Detection Portal</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn ${!isRegisterMode ? 'active' : ''}`}
            onClick={() => setIsRegisterMode(false)}
          >
            Login
          </button>
          <button
            type="button"
            className={`mode-btn ${isRegisterMode ? 'active' : ''}`}
            onClick={() => setIsRegisterMode(true)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {isRegisterMode && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="form-input"
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="form-input"
                  placeholder="Anti-Fraud Unit"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="form-input"
              placeholder="your.email@gov.ph"
              required
            />
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="form-input"
                required
              >
                <option value="analyst">Analyst</option>
                <option value="investigator">Investigator</option>
                <option value="admin">Administrator</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="form-input"
              placeholder="••••••••"
              required
            />
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? (isRegisterMode ? 'Creating Account...' : 'Signing in...') : (isRegisterMode ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {!isRegisterMode && (
          <div className="demo-info">
            <p className="demo-label">Demo Credentials:</p>
            <p className="demo-credentials">admin@chainshield.gov / admin123</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;