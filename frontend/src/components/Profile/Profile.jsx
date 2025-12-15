import React from 'react';
import '../../styles/Profile.css';

function Profile({ user }) {
  return (
    <div className="profile-container">
      <div className="page-hero profile-hero">
        <span className="hero-tag">USER PROFILE</span>
        <h2 className="hero-title">{user.username}, this is your hub</h2>
        <p className="hero-subtitle">Review personal details, confirm your department, and keep your contact information current.</p>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="stat-label">Account Created</div>
            <div className="stat-value">10/26/2025</div>
          </div>
          <div className="profile-stat">
            <div className="stat-label">Last Updated</div>
            <div className="stat-value">10/28/2025</div>
          </div>
        </div>
      </div>

      <div className="profile-cards">
        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}>👤</div>
            <div className="info-content">
              <div className="info-label">Full Name</div>
              <div className="info-value">{user.username}</div>
              <div className="info-hint">Used in certificates and reports</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#22c55e20', color: '#22c55e' }}>📧</div>
            <div className="info-content">
              <div className="info-label">Email</div>
              <div className="info-value">{user.email}</div>
              <div className="info-hint">Log-in and notification address</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}>🏢</div>
            <div className="info-content">
              <div className="info-label">Department</div>
              <div className="info-value">{user.department}</div>
              <div className="info-hint">Your assigned unit</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>🎯</div>
            <div className="info-content">
              <div className="info-label">Role</div>
              <div className="info-value">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</div>
              <div className="info-hint">Access level</div>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <div className="section-header">
          <h3 className="section-title">Contact Information</h3>
          <button className="edit-btn">✏️ Edit details</button>
        </div>
        <div className="contact-info">
          <div className="contact-row">
            <span className="contact-label">Full Name</span>
            <span className="contact-value">{user.username}</span>
          </div>
          <div className="contact-row">
            <span className="contact-label">Email Address</span>
            <span className="contact-value">{user.email}</span>
          </div>
          <div className="contact-row">
            <span className="contact-label">User Reference ID</span>
            <span className="contact-value">USR{user.id}20250101</span>
          </div>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="section-title">Security</h3>
        <p className="section-subtitle">Change your password to keep your account secure.</p>
        <div className="security-form">
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" placeholder="Enter current password" />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input type="password" className="form-input" placeholder="Enter new password" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input type="password" className="form-input" placeholder="Confirm new password" />
          </div>
          <button className="update-btn">🔒 Update Password</button>
          <p className="security-hint">Passwords must be at least 6 characters long. Avoid reusing old passwords for better security.</p>
        </div>
      </div>
    </div>
  );
}

export default Profile;