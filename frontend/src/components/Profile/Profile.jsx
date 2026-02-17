import React, { useState, useEffect } from 'react';
import { User, Edit, Lock, Mail, Building, Target, Send, X, Shield, Smartphone, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Profile.css';
import '../../styles/ColorfulIcons.css';

function Profile({ user }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2faModal, setShow2faModal] = useState(false);

  const [editForm, setEditForm] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
    email: user.email,
    otp: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    otp: ''
  });

  const [twoFactorForm, setTwoFactorForm] = useState({
    password: '',
    otp: '',
    totpCode: '',
    mode: 'setup' // setup | disable
  });

  const [editOtpSent, setEditOtpSent] = useState(false);
  const [passwordOtpSent, setPasswordOtpSent] = useState(false);
  const [twoFactorOtpSent, setTwoFactorOtpSent] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpenEditModal = () => {
    setShowEditModal(true);
    setEditOtpSent(false);
    setMessage('');
    setError('');
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
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
      setError('New passwords do not match');
      return;
    }

    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        otp: passwordForm.otp
      });

      setMessage('Password updated successfully!');
      setError('');

      setTimeout(() => {
        handleClosePasswordModal();
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
          otp: ''
        });
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password');
    }
  };

  const handleOpen2faModal = (mode) => {
    setShow2faModal(true);
    setTwoFactorOtpSent(false);
    setQrCode('');
    setSecret('');
    setRecoveryCodes([]);
    setMessage('');
    setError('');
    setTwoFactorForm({
      password: '',
      otp: '',
      totpCode: '',
      mode
    });
  };

  const handleClose2faModal = () => {
    setShow2faModal(false);
    setTwoFactorOtpSent(false);
    setQrCode('');
    setSecret('');
    setMessage('');
    setError('');
  };

  const handleSend2faOTP = async () => {
    try {
      await api.post('/auth/2fa/send-otp');
      setTwoFactorOtpSent(true);
      setMessage('OTP sent to your email!');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    }
  };

  const handle2faVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (twoFactorForm.mode === 'disable') {
        await api.post('/auth/2fa/disable', {
          password: twoFactorForm.password,
          otp: twoFactorForm.otp
        });
        setMessage('2FA has been disabled successfully!');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        // Change or Enable
        const response = await api.post('/auth/2fa/reset', {
          password: twoFactorForm.password,
          otp: twoFactorForm.otp
        });
        setQrCode(response.data.qrCode);
        setSecret(response.data.secret);
        setTwoFactorForm({ ...twoFactorForm, mode: 'verify-totp' });
        setMessage('2FA reset initiated. Please scan the QR code.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/2fa/verify-setup', {
        totpCode: twoFactorForm.totpCode
      });
      setRecoveryCodes(response.data.recoveryCodes);
      setTwoFactorForm({ ...twoFactorForm, mode: 'recovery' });
      setMessage('2FA enabled successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid TOTP code');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <span className="contact-label">First Name</span>
            <span className="contact-value">{user.firstName}</span>
          </div>
          <div className="contact-row">
            <span className="contact-label">Last Name</span>
            <span className="contact-value">{user.lastName}</span>
          </div>
          {user.birthday && (
            <div className="contact-row">
              <span className="contact-label">Birthday</span>
              <span className="contact-value">{new Date(user.birthday).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          )}
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
        <p className="section-subtitle">Manage your account protection and credentials.</p>

        <div className="security-controls">
          <div className="security-item">
            <div className="security-info">
              <span className="security-label">Account Password</span>
              <span className="security-desc">Update your login password regularly</span>
            </div>
            <button className="edit-btn secondary" onClick={handleOpenPasswordModal}>
              <Lock size={16} /> Change Password
            </button>
          </div>

          <div className="security-item">
            <div className="security-info">
              <div className="security-label-group">
                <span className="security-label">Two-Factor Authentication (2FA)</span>
                <span className={`status-badge ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`}>
                  {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <span className="security-desc">Protect your account with an extra verification step</span>
            </div>
            <div className="security-actions">
              {user.twoFactorEnabled ? (
                <>
                  <button className="edit-btn secondary" onClick={() => handleOpen2faModal('setup')}>
                    <Smartphone size={16} /> Change 2FA
                  </button>
                  <button className="edit-btn danger" onClick={() => handleOpen2faModal('disable')}>
                    <Shield size={16} /> Disable 2FA
                  </button>
                </>
              ) : (
                <button className="edit-btn success" onClick={() => handleOpen2faModal('setup')}>
                  <Shield size={16} /> Enable 2FA
                </button>
              )}
            </div>
          </div>
        </div>
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
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Birthday</label>
                <input
                  type="date"
                  className="form-input"
                  value={editForm.birthday}
                  onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
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
      {/* 2FA Management Modal */}
      {show2faModal && (
        <div className="modal-overlay" onClick={handleClose2faModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {twoFactorForm.mode === 'disable' ? 'Disable 2FA' :
                  twoFactorForm.mode === 'verify-totp' ? 'Authenticator Setup' :
                    twoFactorForm.mode === 'recovery' ? 'Save Recovery Codes' : 'Setup 2FA'}
              </h3>
              <button className="modal-close" onClick={handleClose2faModal}>
                <X size={20} />
              </button>
            </div>

            {message && <div className="success-banner">{message}</div>}
            {error && <div className="error-banner">{error}</div>}

            <div className="modal-form">
              {(twoFactorForm.mode === 'setup' || twoFactorForm.mode === 'disable') && (
                <form onSubmit={handle2faVerify} className="inner-form">
                  <p className="form-hint">
                    For your security, please verify your identity with your password and an email code.
                  </p>

                  <div className="form-group">
                    <label className="form-label">Account Password</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Enter your current password"
                      value={twoFactorForm.password}
                      onChange={(e) => setTwoFactorForm({ ...twoFactorForm, password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="otp-section">
                    <div className="form-group">
                      <label className="form-label">Email OTP Verification</label>
                      <div className="otp-input-group">
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Enter OTP from email"
                          value={twoFactorForm.otp}
                          onChange={(e) => setTwoFactorForm({ ...twoFactorForm, otp: e.target.value })}
                          required
                          disabled={!twoFactorOtpSent}
                        />
                        <button
                          type="button"
                          className="otp-btn"
                          onClick={handleSend2faOTP}
                          disabled={twoFactorOtpSent}
                        >
                          <Send size={16} /> {twoFactorOtpSent ? 'Sent' : 'Send OTP'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button type="submit" className={`update-btn ${twoFactorForm.mode === 'disable' ? 'danger' : ''}`} disabled={loading || !twoFactorOtpSent}>
                    {loading ? <span className="spinner"></span> :
                      (twoFactorForm.mode === 'disable' ? 'Verify & Disable 2FA' : 'Verify & Continue')}
                  </button>
                </form>
              )}

              {twoFactorForm.mode === 'verify-totp' && (
                <form onSubmit={handleTotpVerify} className="inner-form">
                  <div className="qr-box">
                    <p className="qr-text">Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
                    {qrCode && <img src={qrCode} alt="2FA QR Code" className="qr-image" />}

                    <div className="manual-entry">
                      <span className="manual-label">Unable to scan? Use this secret:</span>
                      <div className="secret-display">
                        <code>{secret}</code>
                        <button type="button" onClick={copySecret} className="copy-icon">
                          {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Verification Code</label>
                    <input
                      type="text"
                      className="form-input totp-input"
                      placeholder="000 000"
                      value={twoFactorForm.totpCode}
                      onChange={(e) => setTwoFactorForm({ ...twoFactorForm, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      required
                      maxLength={6}
                      autoFocus
                    />
                    <p className="security-hint">Enter the 6-digit code from your app to verify setup</p>
                  </div>

                  <button type="submit" className="update-btn" disabled={loading || twoFactorForm.totpCode.length < 6}>
                    {loading ? <span className="spinner"></span> : 'Complete Setup'}
                  </button>
                </form>
              )}

              {twoFactorForm.mode === 'recovery' && (
                <div className="recovery-flow">
                  <div className="recovery-notice">
                    <AlertTriangle size={24} />
                    <div>
                      <strong>Save your recovery codes!</strong>
                      <p>If you lose your device, these codes are the ONLY way to access your account.</p>
                    </div>
                  </div>

                  <div className="recovery-grid">
                    {recoveryCodes.map((code, idx) => (
                      <div key={idx} className="recovery-code">{code}</div>
                    ))}
                  </div>

                  <button
                    className="update-btn"
                    onClick={() => window.location.reload()}
                  >
                    I've saved my codes - Finish
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;