import React, { useState, useEffect } from 'react';
import { User, Edit, Lock, Mail, Building, Target, Send, X, Shield, Smartphone, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Profile.css';
import '../../styles/ColorfulIcons.css';

function Profile({ user }) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2faModal, setShow2faModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

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
    mode: 'setup' // setup | disable | verify-totp | recovery
  });

  const [recoveryForm, setRecoveryForm] = useState({
    password: '',
    otp: ''
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

  // Modals Open/Close
  const handleOpenEditModal = () => {
    setShowEditModal(true);
    setEditOtpSent(false);
    setMessage(''); setError('');
  };
  const handleCloseEditModal = () => setShowEditModal(false);

  const handleOpenPasswordModal = () => {
    setShowPasswordModal(true);
    setPasswordOtpSent(false);
    setMessage(''); setError('');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' });
  };
  const handleClosePasswordModal = () => setShowPasswordModal(false);

  const handleOpen2faModal = (mode) => {
    setShow2faModal(true);
    setTwoFactorOtpSent(false);
    setQrCode(''); setSecret(''); setRecoveryCodes([]);
    setMessage(''); setError('');
    setTwoFactorForm({ password: '', otp: '', totpCode: '', mode });
  };
  const handleClose2faModal = () => setShow2faModal(false);

  const handleOpenRecoveryModal = () => {
    setShowRecoveryModal(true);
    setTwoFactorOtpSent(false);
    setMessage(''); setError('');
    setRecoveryForm({ password: '', otp: '' });
  };
  const handleCloseRecoveryModal = () => setShowRecoveryModal(false);

  // OTP Handlers
  const handleSendEditOTP = async () => {
    try {
      await api.post('/auth/send-profile-otp');
      setEditOtpSent(true);
      setMessage('OTP sent to your email!');
    } catch (err) { setError(err.response?.data?.message || 'Failed to send OTP'); }
  };

  const handleSendPasswordOTP = async () => {
    try {
      await api.post('/auth/send-password-otp');
      setPasswordOtpSent(true);
      setMessage('OTP sent to your email!');
    } catch (err) { setError(err.response?.data?.message || 'Failed to send OTP'); }
  };

  const handleSend2faOTP = async () => {
    try {
      await api.post('/auth/2fa/send-otp');
      setTwoFactorOtpSent(true);
      setMessage('OTP sent to your email!');
    } catch (err) { setError(err.response?.data?.error || 'Failed to send OTP'); }
  };

  // Submit Handlers
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editOtpSent) { setError('Please request OTP first'); return; }
    try {
      await api.put('/auth/update-profile', editForm);
      setMessage('Profile updated successfully!');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { setError(err.response?.data?.message || 'Failed to update profile'); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { setError('New passwords do not match'); return; }
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        otp: passwordForm.otp
      });
      setMessage('Password updated successfully!');
      setTimeout(() => handleClosePasswordModal(), 1500);
    } catch (err) { setError(err.response?.data?.error || 'Failed to update password'); }
  };

  const handle2faVerify = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      if (twoFactorForm.mode === 'disable') {
        await api.post('/auth/2fa/disable', { password: twoFactorForm.password, otp: twoFactorForm.otp });
        setMessage('2FA has been disabled successfully!');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const response = await api.post('/auth/2fa/reset', { password: twoFactorForm.password, otp: twoFactorForm.otp });
        setQrCode(response.data.qrCode);
        setSecret(response.data.secret);
        setTwoFactorForm({ ...twoFactorForm, mode: 'verify-totp' });
        setMessage('2FA reset initiated. Please scan the QR code.');
      }
    } catch (err) { setError(err.response?.data?.error || 'Verification failed'); }
    finally { setLoading(false); }
  };

  const handleTotpVerify = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await api.post('/auth/2fa/verify-setup', { totpCode: twoFactorForm.totpCode });
      setRecoveryCodes(response.data.recoveryCodes);
      setTwoFactorForm({ ...twoFactorForm, mode: 'recovery' });
      setMessage('2FA enabled successfully!');
    } catch (err) { setError(err.response?.data?.error || 'Invalid TOTP code'); }
    finally { setLoading(false); }
  };

  const handleRegenerateRecoveryCodes = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const response = await api.post('/auth/2fa/recovery-codes/regenerate', {
        password: recoveryForm.password,
        otp: recoveryForm.otp
      });
      setRecoveryCodes(response.data.codes);
      setTwoFactorForm({ ...twoFactorForm, mode: 'recovery' });
      setShowRecoveryModal(false);
      setShow2faModal(true);
      setMessage('Recovery codes regenerated successfully!');
    } catch (err) { setError(err.response?.data?.error || 'Verification failed'); }
    finally { setLoading(false); }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="profile-container">
      {/* Hero Header */}
      <div className="page-hero profile-hero">
        <span className="hero-tag">USER PROFILE</span>
        <h2 className="hero-title">{user.username}, this is your hub</h2>
        <p className="hero-subtitle">Review personal details and manage account security.</p>
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="stat-label">Account Created</div>
            <div className="stat-value">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</div>
          </div>
          <div className="profile-stat">
            <div className="stat-label">Last Updated</div>
            <div className="stat-value">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="profile-cards">
        {[
          { icon: <User size={24} />, label: 'Full Name', value: user.username, hint: 'Official record name', color: '#3b82f6' },
          { icon: <Mail size={24} />, label: 'Email', value: user.email, hint: 'Login address', color: '#22c55e' },
          { icon: <Building size={24} />, label: 'Department', value: user.department, hint: 'Assigned unit', color: '#f59e0b' },
          { icon: <Target size={24} />, label: 'Role', value: user.role, hint: 'Access level', color: '#8b5cf6' }
        ].map((item, i) => (
          <div key={i} className="profile-info-card">
            <div className="info-item">
              <div className="info-icon" style={{ background: `${item.color}20`, color: item.color }}>{item.icon}</div>
              <div className="info-content">
                <div className="info-label">{item.label}</div>
                <div className="info-value">{item.value}</div>
                <div className="info-hint">{item.hint}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections */}
      <div className="profile-section">
        <div className="section-header">
          <h3 className="section-title">Contact Information</h3>
          <button className="edit-btn" onClick={handleOpenEditModal}><Edit size={16} /> Edit details</button>
        </div>
        <div className="contact-info">
          <div className="contact-row"><span className="contact-label">First Name</span><span className="contact-value">{user.firstName}</span></div>
          <div className="contact-row"><span className="contact-label">Last Name</span><span className="contact-value">{user.lastName}</span></div>
          {user.birthday && <div className="contact-row"><span className="contact-label">Birthday</span><span className="contact-value">{new Date(user.birthday).toLocaleDateString()}</span></div>}
          <div className="contact-row"><span className="contact-label">Email Address</span><span className="contact-value">{user.email}</span></div>
        </div>
      </div>

      <div className="profile-section">
        <h3 className="section-title">Security</h3>
        <p className="section-subtitle">Manage account protection.</p>
        <div className="security-controls">
          <div className="security-item">
            <div className="security-info">
              <span className="security-label">Account Password</span>
              <span className="security-desc">Update your login credentials</span>
            </div>
            <button className="edit-btn secondary" onClick={handleOpenPasswordModal}><Lock size={16} /> Change Password</button>
          </div>

          <div className="security-item">
            <div className="security-info">
              <div className="security-label-group">
                <span className="security-label">Two-Factor Authentication (2FA)</span>
                <span className={`status-badge ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`}>{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <span className="security-desc">Extra security for your account</span>
            </div>
            <div className="security-actions">
              {user.twoFactorEnabled ? (
                <>
                  <button className="edit-btn secondary" onClick={() => handleOpen2faModal('setup')}><Smartphone size={16} /> Change 2FA</button>
                  <button className="edit-btn danger" onClick={() => handleOpen2faModal('disable')}><Shield size={16} /> Disable 2FA</button>
                </>
              ) : <button className="edit-btn success" onClick={() => handleOpen2faModal('setup')}><Shield size={16} /> Enable 2FA</button>}
            </div>
          </div>

          {user.twoFactorEnabled && (
            <div className="security-item">
              <div className="security-info">
                <div className="security-label-group">
                  <span className="security-label">Recovery Codes</span>
                  <span className={`status-badge ${user.recoveryCodeCount > 0 ? 'enabled' : 'disabled'}`}>{user.recoveryCodeCount} remaining</span>
                </div>
                <span className="security-desc">Backup access in case of device loss</span>
              </div>
              <button className="edit-btn secondary" onClick={handleOpenRecoveryModal}><Lock size={16} /> Manage Codes</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals Implementation */}
      {showEditModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3 className="modal-title">Edit Profile</h3><button className="modal-close" onClick={handleCloseEditModal}><X /></button></div>
            <div className="modal-form">
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
              <form onSubmit={handleEditSubmit} className="inner-form">
                <div className="form-group"><label className="form-label">First Name</label><input type="text" className="form-input" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input type="text" className="form-input" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required /></div>
                <div className="otp-section"><label className="form-label">OTP Verification</label><div className="otp-input-group"><input type="text" className="form-input" value={editForm.otp} onChange={(e) => setEditForm({ ...editForm, otp: e.target.value })} required disabled={!editOtpSent} /><button type="button" className="otp-btn" onClick={handleSendEditOTP} disabled={editOtpSent}><Send size={16} /> {editOtpSent ? 'Sent' : 'Send OTP'}</button></div></div>
                <button type="submit" className="update-btn">Save Changes</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3 className="modal-title">Change Password</h3><button className="modal-close" onClick={handleClosePasswordModal}><X /></button></div>
            <div className="modal-form">
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
              <form onSubmit={handlePasswordChange} className="inner-form">
                <div className="form-group"><label className="form-label">Current Password</label><input type="password" className="form-input" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">New Password</label><input type="password" className="form-input" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Confirm New Password</label><input type="password" className="form-input" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required /></div>
                <div className="otp-section"><label className="form-label">OTP Code</label><div className="otp-input-group"><input type="text" className="form-input" value={passwordForm.otp} onChange={(e) => setPasswordForm({ ...passwordForm, otp: e.target.value })} required disabled={!passwordOtpSent} /><button type="button" className="otp-btn" onClick={handleSendPasswordOTP} disabled={passwordOtpSent}><Send size={16} /> {passwordOtpSent ? 'Sent' : 'Send OTP'}</button></div></div>
                <button type="submit" className="update-btn">Update Password</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {show2faModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">{twoFactorForm.mode === 'disable' ? 'Disable 2FA' : twoFactorForm.mode === 'recovery' ? 'Your Recovery Codes' : 'Secure Your Account'}</h3>
              <button className="modal-close" onClick={handleClose2faModal}><X /></button>
            </div>
            <div className="modal-form">
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
              {twoFactorForm.mode === 'recovery' ? (
                <div className="recovery-flow">
                  <div className="recovery-notice"><Shield size={24} /><div><strong>Save these codes!</strong><p>Required if you lose your phone.</p></div></div>
                  <div className="recovery-grid">{recoveryCodes.map((c, i) => <div key={i} className="recovery-code">{c}</div>)}</div>
                  <button className="update-btn" onClick={() => window.location.reload()}>I have saved these codes</button>
                </div>
              ) : twoFactorForm.mode === 'verify-totp' ? (
                <form className="inner-form" onSubmit={handleTotpVerify}>
                  <div className="qr-box">
                    <p className="qr-text">Scan this QR code with your authenticator app.</p>
                    <img src={qrCode} alt="QR" className="qr-image" />
                    <div className="secret-display"><code>{secret}</code><button type="button" onClick={copySecret}>{copied ? <CheckCircle size={16} color="#22c55e" /> : <Copy size={16} />}</button></div>
                  </div>
                  <div className="form-group"><label className="form-label">Authenticator Code</label><input type="text" className="form-input" maxLength="6" value={twoFactorForm.totpCode} onChange={(e) => setTwoFactorForm({ ...twoFactorForm, totpCode: e.target.value })} required /></div>
                  <button type="submit" className="update-btn" disabled={loading}>Complete Setup</button>
                </form>
              ) : (
                <form className="inner-form" onSubmit={handle2faVerify}>
                  <div className="form-group">
                    <label className="form-label">Account Password</label>
                    {user.authProvider === 'google' ? <div className="auth-provider-info"><span className="info-badge">Google Account</span></div> : <input type="password" className="form-input" value={twoFactorForm.password} onChange={(e) => setTwoFactorForm({ ...twoFactorForm, password: e.target.value })} required />}
                  </div>
                  <div className="otp-section"><label className="form-label">Email OTP</label><div className="otp-input-group"><input type="text" className="form-input" value={twoFactorForm.otp} onChange={(e) => setTwoFactorForm({ ...twoFactorForm, otp: e.target.value })} required /><button type="button" className="otp-btn" onClick={handleSend2faOTP} disabled={twoFactorOtpSent}>{twoFactorOtpSent ? 'Sent' : 'Send Code'}</button></div></div>
                  <button type="submit" className={`update-btn ${twoFactorForm.mode === 'disable' ? 'danger' : ''}`} disabled={loading}>{twoFactorForm.mode === 'disable' ? 'Confirm Disable' : 'Initiate Setup'}</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecoveryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3 className="modal-title">Regenerate Recovery Codes</h3><button className="modal-close" onClick={handleCloseRecoveryModal}><X /></button></div>
            <div className="modal-form">
              {error && <div className="error-banner">{error}</div>}
              {message && <div className="success-banner">{message}</div>}
              <form className="inner-form" onSubmit={handleRegenerateRecoveryCodes}>
                <p className="form-hint">Regenerating codes will invalidate your old ones. You will see 8 new codes.</p>
                <div className="form-group">
                  <label className="form-label">Account Password</label>
                  {user.authProvider === 'google' ? <div className="auth-provider-info"><span className="info-badge">Google Account</span></div> : <input type="password" className="form-input" value={recoveryForm.password} onChange={(e) => setRecoveryForm({ ...recoveryForm, password: e.target.value })} required />}
                </div>
                <div className="otp-section"><label className="form-label">Email OTP</label><div className="otp-input-group"><input type="text" className="form-input" value={recoveryForm.otp} onChange={(e) => setRecoveryForm({ ...recoveryForm, otp: e.target.value })} required /><button type="button" className="otp-btn" onClick={handleSend2faOTP} disabled={twoFactorOtpSent}>{twoFactorOtpSent ? 'Sent' : 'Send Code'}</button></div></div>
                <button type="submit" className="update-btn" disabled={loading}>Regenerate Codes</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;