import React, { useState } from 'react';
import { Shield, Lock, ArrowRight, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import '../../styles/Login.css';
import { authAPI } from '../../services/api';

function ForcePasswordChange({ onNavigate }) {
    // Default email is empty, but user should probably enter their own.
    // Ideally we could pre-fill if we knew the current email, but for admin reset it's fine to ask.
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const passwordChecks = {
        length: newPassword.length >= 8,
        uppercase: /[A-Z]/.test(newPassword),
        lowercase: /[a-z]/.test(newPassword),
        number: /\d/.test(newPassword),
        special: /[@$!%*?&]/.test(newPassword),
        match: newPassword === confirmPassword && confirmPassword.length > 0,
    };

    const allPassed = Object.values(passwordChecks).every(Boolean);
    const strengthScore = Object.values(passwordChecks).filter(Boolean).length;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!allPassed) {
            setError('Please ensure all password requirements are met.');
            return;
        }

        setLoading(true);

        try {
            const response = await authAPI.forceChangePassword({ newPassword, newEmail });
            const data = response.data;

            if (data.verifyEmail) {
                // If email changed, go to verification
                // Assuming onNavigate can pass params, or we just rely on user re-login/check email
                // Actually, the common flow in App.jsx handles 'email-verify' with user object
                onNavigate('email-verify', { email: data.email, isVerified: false });
                return;
            }

            if (data.mustSetup2FA) {
                // Token is in cookie now
                onNavigate('setup-2fa');
                return;
            }

            // Token is in cookie now
            onNavigate('login');
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setLoading(false);
        }
    };

    const getStrengthColor = () => {
        if (strengthScore <= 2) return '#e74c3c';
        if (strengthScore <= 4) return '#f39c12';
        return '#27ae60';
    };

    const getStrengthLabel = () => {
        if (strengthScore <= 2) return 'Weak';
        if (strengthScore <= 4) return 'Fair';
        return 'Strong';
    };

    return (
        <div className="auth-container">
            <div className="auth-sidebar">
                <div className="auth-sidebar-content">
                    <div className="sidebar-brand">
                        <div className="sidebar-logo"><Shield size={48} /></div>
                        <h2 className="sidebar-title">ChainShield</h2>
                        <p className="sidebar-subtitle">Security Setup</p>
                    </div>

                    <div className="sidebar-illustration">
                        <div className="illustration-circle"></div>
                        <div className="illustration-icon"><Lock size={64} /></div>
                    </div>

                    <div className="sidebar-info">
                        <h3 className="sidebar-info-title">Password Change Required</h3>
                        <p className="sidebar-info-text">
                            Your account has a temporary password. You must set a strong permanent password before continuing.
                        </p>
                    </div>
                </div>
            </div>

            <div className="auth-main">
                <div className="auth-content">
                    <div className="auth-header">
                        <h1 className="auth-title">Set New Password</h1>
                        <p className="auth-subtitle">Create a strong password for your account</p>
                    </div>

                    {error && (
                        <div className="alert-box error">
                            <span className="alert-icon"><AlertCircle size={20} /></span>
                            <span className="alert-message">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Lock size={18} /></span>
                                <span>New Email Address</span>
                            </label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="field-input"
                                placeholder="your.name@example.com"
                                required
                            />
                            <span className="field-hint">Update your email from the default admin address.</span>
                        </div>

                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Lock size={18} /></span>
                                <span>New Password</span>
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="field-input"
                                    placeholder="Enter new password"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', color: '#999'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Strength bar */}
                            {newPassword.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                            <div key={i} style={{
                                                flex: 1, height: 4, borderRadius: 2,
                                                background: i <= strengthScore ? getStrengthColor() : '#e0e0e0'
                                            }} />
                                        ))}
                                    </div>
                                    <span style={{ fontSize: 12, color: getStrengthColor(), fontWeight: 600 }}>
                                        {getStrengthLabel()}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Lock size={18} /></span>
                                <span>Confirm Password</span>
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="field-input"
                                placeholder="Confirm new password"
                                required
                            />
                        </div>

                        {/* Requirements checklist */}
                        <div className="password-requirements">
                            {[
                                { key: 'length', label: 'At least 8 characters' },
                                { key: 'uppercase', label: 'One uppercase letter' },
                                { key: 'lowercase', label: 'One lowercase letter' },
                                { key: 'number', label: 'One number' },
                                { key: 'special', label: 'One special character (@$!%*?&)' },
                                { key: 'match', label: 'Passwords match' },
                            ].map(({ key, label }) => (
                                <div key={key} className="req-item" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                                    {passwordChecks[key]
                                        ? <CheckCircle size={14} color="#27ae60" />
                                        : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #ccc' }} />}
                                    <span style={{ fontSize: 13, color: passwordChecks[key] ? '#27ae60' : '#999' }}>{label}</span>
                                </div>
                            ))}
                        </div>

                        <button type="submit" disabled={loading || !allPassed} className="submit-button">
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    <span>Changing Password...</span>
                                </>
                            ) : (
                                <>
                                    <span>Set Password & Continue</span>
                                    <span className="button-icon"><ArrowRight size={18} /></span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ForcePasswordChange;
