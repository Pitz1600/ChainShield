import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Login.css'; // Reuse login styles

const AdminOnboarding = ({ user, onNavigate, onLogin }) => {
    const [formData, setFormData] = useState({
        newEmail: user?.email || '',
        newPassword: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const response = await api.post('/auth/complete-onboarding', {
                newEmail: formData.newEmail,
                newPassword: formData.newPassword
            });

            if (response.data.success) {
                setSuccess('Account setup complete!');

                if (response.data.emailChanged) {
                    // If email changed, they need to verify it
                    setTimeout(() => {
                        onNavigate('email-verify', { ...user, email: formData.newEmail });
                    }, 1500);
                } else {
                    // Just login
                    setTimeout(() => {
                        // We need to re-login essentially or just update local state
                        // Ideally, we prompt them to login again or just proceed
                        // Since this is "complete onboarding", let's proceed to dashboard
                        // We might need to refresh the token if roles changed, but here just metadata changed
                        // The parent App.jsx might need a trigger to refresh user data
                        onNavigate('dashboard'); // This might not work if not authenticated in App state
                        // Better: trigger login callback with current token if we have it?
                        // Actually, complete-onboarding is protected, so we are logged in.
                        // We should just update the user state in App.js
                        // For now, let's redirect to dashboard if `onLogin` can update state.
                        // But `onLogin` expects token.
                        // Let's reload the page or call onNavigate('dashboard')
                        window.location.reload();
                    }, 1500);
                }
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-sidebar">
                <div className="auth-sidebar-content">
                    <div className="sidebar-brand">
                        <div className="sidebar-logo"><Shield size={48} /></div>
                        <h2 className="sidebar-title">ChainShield</h2>
                        <p className="sidebar-subtitle">Admin Setup</p>
                    </div>
                    <div className="sidebar-illustration">
                        <div className="illustration-circle"></div>
                        <div className="illustration-icon"><Lock size={64} /></div>
                    </div>
                    <div className="sidebar-info">
                        <h3 className="sidebar-info-title">Security Check</h3>
                        <p className="sidebar-info-text">
                            As a new administrator, you must secure your account by updating your credentials.
                        </p>
                    </div>
                </div>
            </div>

            <div className="auth-main">
                <div className="auth-content">
                    <div className="auth-header">
                        <h1 className="auth-title">Secure Your Account</h1>
                        <p className="auth-subtitle">Update your default credentials</p>
                    </div>

                    {error && (
                        <div className="alert-box error">
                            <span className="alert-icon"><AlertCircle size={20} /></span>
                            <span className="alert-message">{error}</span>
                        </div>
                    )}

                    {success && (
                        <div className="alert-box success">
                            <span className="alert-icon"><CheckCircle size={20} /></span>
                            <span className="alert-message">{success}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Mail size={18} /></span>
                                <span>Update Email Address</span>
                            </label>
                            <input
                                type="email"
                                value={formData.newEmail}
                                onChange={(e) => setFormData({ ...formData, newEmail: e.target.value })}
                                className="field-input"
                                required
                            />
                            <span className="field-hint">We'll send a verification code to this email</span>
                        </div>

                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Lock size={18} /></span>
                                <span>New Password</span>
                            </label>
                            <input
                                type="password"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                className="field-input"
                                placeholder="New strong password"
                            />
                        </div>

                        <div className="form-field">
                            <label className="field-label">
                                <span className="label-icon"><Lock size={18} /></span>
                                <span>Confirm Password</span>
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="field-input"
                                placeholder="Confirm new password"
                            />
                        </div>

                        <button type="submit" disabled={loading} className="submit-button">
                            {loading ? (
                                <>
                                    <span className="spinner"></span>
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Save & Continue</span>
                                    <span className="button-icon"><ArrowRight size={18} /></span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AdminOnboarding;
