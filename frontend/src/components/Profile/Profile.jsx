import React, { useState } from 'react';
import { User, Edit, Lock, Mail, Building, Target, Send, X } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Profile.css';
import '../../styles/ColorfulIcons.css';

function Profile({ user }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [editForm, setEditForm] = useState({
    username: user.username,
    email: user.email,
    otp: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    otp: ''
  });

  const [editOtpSent, setEditOtpSent] = useState(false);
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleOpenEditModal = () => {
    setShowEditModal(true);
    setEditOtpSent(false);
    setMessage('');
    setError('');
    setEditForm({
      username: user.username,
      email: user.email,
      otp: ''
    });
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setEditOtpSent(false);
    setMessage('');
    setError('');
  };

  const handleOpenPasswordModal = () => {
    setShowPasswordModal(true);
    setPasswordOtpSent(false);
    setMessage('');
    setError('');
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      otp: ''
    });
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordOtpSent(false);
    setMessage('');
    setError('');
  };

  const handleSendEditOTP = async () => {
    try {
      await api.post('/auth/send-profile-otp');
      setEditOtpSent(true);
      setMessage('OTP sent to your email!');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editOtpSent) {
      setError('Please request OTP first');
      return;
    }

    try {
      const response = await api.put('/auth/update-profile', editForm);
      setMessage('Profile updated successfully!');
      setError('');
      setTimeout(() => {
        handleCloseEditModal();
        window.location.reload();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile');
    }
  };

  const handleSendPasswordOTP = async () => {
    try {
      await api.post('/auth/send-password-otp');
      setPasswordOtpSent(true);
      setMessage('OTP sent to your email!');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (!passwordOtpSent) {
      setError('Please request OTP first');
      return;
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        otp: passwordForm.otp
      });

      setMessage('Password changed successfully!');
      setError('');
      setTimeout(() => {
        handleClosePasswordModal();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    }
  };

  return (
    <div className="profile-container">
      <div className="page-hero profile-hero">
        <span className="hero-tag">USER PROFILE</span>
        <h2 className="hero-title">{user.username}, this is your hub</h2>
        <p className="hero-subtitle">Review personal details, confirm your department, and keep your contact information current.</p>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="stat-label">Account Created</div>
            <div className="stat-value">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : 'N/A'}
            </div>
          </div>
          <div className="profile-stat">
            <div className="stat-label">Last Updated</div>
            <div className="stat-value">
              {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              }) : 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-cards">
        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#3b82f620', color: '#3b82f6' }}><User size={24} /></div>
            <div className="info-content">
              <div className="info-label">Full Name</div>
              <div className="info-value">{user.username}</div>
              <div className="info-hint">Used in certificates and reports</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#22c55e20', color: '#22c55e' }}><Mail size={24} /></div>
            <div className="info-content">
              <div className="info-label">Email</div>
              <div className="info-value">{user.email}</div>
              <div className="info-hint">Log-in and notification address</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#f59e0b20', color: '#f59e0b' }}><Building size={24} /></div>
            <div className="info-content">
              <div className="info-label">Department</div>
              <div className="info-value">{user.department}</div>
              <div className="info-hint">Your assigned unit</div>
            </div>
          </div>
        </div>

        <div className="profile-info-card">
          <div className="info-item">
            <div className="info-icon" style={{ background: '#8b5cf620', color: '#8b5cf6' }}><Target size={24} /></div>
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
          <button className="edit-btn" onClick={handleOpenEditModal}>
            <Edit size={16} /> Edit details
          </button>
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
        <p className="section-subtitle">Change your password to keep your account secure. OTP verification required.</p>
        <button className="edit-btn" onClick={handleOpenPasswordModal}>
          <Lock size={16} /> Change Password
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Profile</h3>
              <button className="modal-close" onClick={handleCloseEditModal}>
                <X size={20} />
              </button>
            </div>

            {message && <div className="success-banner">{message}</div>}
            {error && <div className="error-banner">{error}</div>}

            <form onSubmit={handleEditSubmit} className="modal-form">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="otp-section">
                <div className="form-group">
                  <label className="form-label">OTP Verification</label>
                  <div className="otp-input-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter OTP from email"
                      value={editForm.otp}
                      onChange={(e) => setEditForm({ ...editForm, otp: e.target.value })}
                      required
                      disabled={!editOtpSent}
                    />
                    <button
                      type="button"
                      className="otp-btn"
                      onClick={handleSendEditOTP}
                      disabled={editOtpSent}
                    >
                      <Send size={16} /> {editOtpSent ? 'OTP Sent' : 'Send OTP'}
                    </button>
                  </div>
                  <p className="security-hint">OTP required to update profile information</p>
                </div>
              </div>

              <button type="submit" className="update-btn">
                <Edit size={16} /> Save Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={handleClosePasswordModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Change Password</h3>
              <button className="modal-close" onClick={handleClosePasswordModal}>
                <X size={20} />
              </button>
            </div>

            {message && <div className="success-banner">{message}</div>}
            {error && <div className="error-banner">{error}</div>}

            <form onSubmit={handlePasswordChange} className="modal-form">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter current password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Enter new password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="otp-section">
                <div className="form-group">
                  <label className="form-label">OTP Code</label>
                  <div className="otp-input-group">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter OTP from email"
                      value={passwordForm.otp}
                      onChange={(e) => setPasswordForm({ ...passwordForm, otp: e.target.value })}
                      required
                      disabled={!passwordOtpSent}
                    />
                    <button
                      type="button"
                      className="otp-btn"
                      onClick={handleSendPasswordOTP}
                      disabled={passwordOtpSent}
                    >
                      <Send size={16} /> {passwordOtpSent ? 'OTP Sent' : 'Send OTP'}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className="update-btn">
                <Lock size={16} /> Update Password
              </button>
              <p className="security-hint">Passwords must be at least 6 characters long. Avoid reusing old passwords for better security.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;