import React, { useState } from 'react';
import '../styles/Login.css';
import { authAPI } from '../services/api';

function Login({ onLogin }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('analyst');
  const [department, setDepartment] = useState('');
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
        // Registration validation
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const response = await authAPI.register({ 
          username, 
          email, 
          password, 
          role,
          department 
        });
        setSuccess('Registration successful! You can now login.');
        // Reset form and switch to login mode
        setTimeout(() => {
          setIsRegisterMode(false);
          setUsername('');
          setDepartment('');
          setConfirmPassword('');
          setSuccess('');
        }, 2000);
      } else {
        // Login
        const response = await authAPI.login({ email, password });
        onLogin(response.data.token, response.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || `${isRegisterMode ? 'Registration' : 'Login'} failed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode(!isRegisterMode);
    setError('');
    setSuccess('');
    setEmail('');
    setPassword('');
    setUsername('');
    setConfirmPassword('');
    setDepartment('');
  };

  return (
    <div className="login-container">
      <div className={`login-card ${isRegisterMode ? 'register-mode' : ''}`}>
        <div className="login-header">
          <div className="login-icon">🛡️</div>
          <h1 className="login-title">ChainShield</h1>
          <p className="login-subtitle">Government Fraud Detection System</p>
        </div>

        {error && (
          <div className="login-error">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
          </div>
        )}

        {success && (
          <div className="login-success">
            <span className="success-icon">✓</span>
            <span className="success-text">{success}</span>
          </div>
        )}

        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-btn ${!isRegisterMode ? 'active' : ''}`}
            onClick={() => !isRegisterMode || toggleMode()}
          >
            Login
          </button>
          <button
            type="button"
            className={`mode-btn ${isRegisterMode ? 'active' : ''}`}
            onClick={() => isRegisterMode || toggleMode()}
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="form-input"
                  placeholder="e.g., Anti-Fraud Unit"
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="your.email@gov.ph"
              required
            />
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="form-input form-select"
                required
              >
                <option value="analyst">Analyst</option>
                <option value="investigator">Investigator</option>
                <option value="admin">Administrator</option>
                <option value="viewer">Viewer</option>
              </select>
              <p className="form-hint">Select your role in the organization</p>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="••••••••"
              required
            />
            {isRegisterMode && (
              <p className="form-hint">Minimum 6 characters</p>
            )}
          </div>

          {isRegisterMode && (
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="form-input"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading 
              ? (isRegisterMode ? 'Creating Account...' : 'Signing in...') 
              : (isRegisterMode ? 'Create Account' : 'Sign In')
            }
          </button>
        </form>

        {!isRegisterMode && (
          <div className="login-demo">
            <p>Demo Credentials:</p>
            <p className="demo-credentials">admin@chainshield.gov / admin123</p>
          </div>
        )}

        {isRegisterMode && (
          <div className="register-info">
            <div className="info-card">
              <span className="info-icon">👥</span>
              <div className="info-content">
                <h4>Role Descriptions</h4>
                <ul>
                  <li><strong>Analyst:</strong> View and analyze fraud alerts</li>
                  <li><strong>Investigator:</strong> Manage cases and investigations</li>
                  <li><strong>Admin:</strong> Full system access and user management</li>
                  <li><strong>Viewer:</strong> Read-only access to reports</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;