import React, { useState, useEffect, useRef } from 'react';
import { Shield, Smartphone, Copy, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import '../../styles/Login.css';
import { authAPI } from '../../services/api';

function TwoFactorSetup({ onLogin, onNavigate, onLogout }) {
    const [step, setStep] = useState('loading'); // loading | scan | verify | recovery
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [totpCode, setTotpCode] = useState('');
    const [recoveryCodes, setRecoveryCodes] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [codesAcknowledged, setCodesAcknowledged] = useState(false);
    const initCalled = useRef(false);

    useEffect(() => {
        if (!initCalled.current) {
            initCalled.current = true;
            initSetup();
        }
    }, []);

    const initSetup = async () => {
        try {
            const response = await authAPI.setup2FA();
            setQrCode(response.data.qrCode);
            setSecret(response.data.secret);
            setStep('scan');
        } catch (err) {
            const msg = err.response?.data?.error || '';
            console.error('[TwoFactorSetup] Init error:', msg, err);
            
            // If 2FA is already enabled (e.g. after a successful verify + page reload),
            // skip straight to a done state instead of showing an error.
            if (msg.toLowerCase().includes('already enabled')) {
                setStep('done');
            } else {
                setError(msg || 'Failed to initialize 2FA setup. Please try refreshing the page.');
                setStep('error');
            }
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.verifySetup2FA({ totpCode });
            const data = response.data;

            if (data.recoveryCodes) {
                setRecoveryCodes(data.recoveryCodes);
                setTotpCode(''); // clear input
                setStep('recovery');
            }
        } catch (err) {
            setTotpCode(''); // clear so user can type a fresh code
            setError(err.response?.data?.error || 'Invalid code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleRestartSetup = async () => {
        setError('');
        setLoading(true);

        try {
            const response = await authAPI.restartSetup2FA();
            setQrCode(response.data.qrCode);
            setSecret(response.data.secret);
            setTotpCode('');
            setStep('scan');
            // Success message
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to restart setup.');
        } finally {
            setLoading(false);
        }
    };

    const copySecret = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const copyRecoveryCodes = () => {
        const codesText = recoveryCodes.join('\n');
        navigator.clipboard.writeText(codesText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleFinish = async () => {
        // Get profile and redirect to dashboard
        try {
            const profileRes = await authAPI.getProfile();
            // Cookie is already set, just update app state
            onLogin(null, profileRes.data);
        } catch {
            onNavigate('login');
        }
    };

    const renderScanStep = () => (
        <div className="setup-content">
            <div className="security-badge">
                <Smartphone size={24} />
                <span>Set Up Authenticator App</span>
            </div>

            <div className="setup-instructions">
                <p><strong>Step 1:</strong> Install Google Authenticator, Microsoft Authenticator, or Authy on your phone.</p>
                <p><strong>Step 2:</strong> Scan the QR code below with your authenticator app:</p>
            </div>

            {qrCode && (
                <div className="qr-container">
                    <img src={qrCode} alt="2FA QR Code" className="qr-code" />
                </div>
            )}

            <div className="manual-entry">
                <p className="manual-label">Can't scan? Enter this code manually:</p>
                <div className="secret-box">
                    <code className="secret-code">{secret}</code>
                    <button className="copy-btn" onClick={copySecret} title="Copy secret">
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            <form onSubmit={handleVerify} className="auth-form" style={{ marginTop: '1.5rem' }}>
                <div className="form-field">
                    <label className="field-label">
                        <span><strong>Step 3:</strong> Enter the 6-digit code from your app</span>
                    </label>
                    <input
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="field-input otp-input"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                        required
                    />
                </div>

                <button type="submit" disabled={loading || totpCode.length < 6} className="submit-button">
                    {loading ? (
                        <>
                            <span className="spinner"></span>
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <span>Verify & Enable 2FA</span>
                            <span className="button-icon"><ArrowRight size={18} /></span>
                        </>
                    )}
                </button>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={handleRestartSetup}
                        disabled={loading}
                        style={{
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            color: '#64748b',
                            padding: '0.75rem 1.5rem',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.target.style.background = '#f1f5f9';
                            e.target.style.color = '#475569';
                        }}
                        onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.color = '#64748b';
                        }}
                    >
                        Generate New QR Code
                    </button>
                </div>
            </form>
        </div>
    );

    const renderRecoveryStep = () => (
        <div className="setup-content">
            <div className="security-badge success">
                <CheckCircle size={24} />
                <span>2FA Enabled Successfully!</span>
            </div>

            <div className="recovery-warning">
                <AlertTriangle size={20} />
                <div>
                    <strong>Save your recovery codes!</strong>
                    <p>These codes can be used to access your account if you lose your authenticator device. Each code can only be used once.</p>
                </div>
            </div>

            <div className="recovery-codes">
                {recoveryCodes.map((code, i) => (
                    <div key={i} className="recovery-code">{code}</div>
                ))}
            </div>

            <button className="copy-btn-full" onClick={copyRecoveryCodes}>
                {copied ? <><CheckCircle size={16} /> Copied!</> : <><Copy size={16} /> Copy All Codes</>}
            </button>

            <div className="form-options" style={{ marginTop: '1.5rem' }}>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        className="checkbox-input"
                        checked={codesAcknowledged}
                        onChange={(e) => setCodesAcknowledged(e.target.checked)}
                    />
                    <span>I have saved my recovery codes in a safe place</span>
                </label>
            </div>

            <button
                className="submit-button"
                disabled={!codesAcknowledged}
                onClick={handleFinish}
                style={{ marginTop: '1rem' }}
            >
                <span>Continue to Dashboard</span>
                <span className="button-icon"><ArrowRight size={18} /></span>
            </button>
        </div>
    );

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
                        <div className="illustration-icon"><Smartphone size={64} /></div>
                    </div>

                    <div className="sidebar-info">
                        <h3 className="sidebar-info-title">Two-Factor Authentication</h3>
                        <p className="sidebar-info-text">
                            {step === 'recovery'
                                ? 'Save your recovery codes — they are your backup access method.'
                                : 'Add an extra layer of security to your account with an authenticator app.'}
                        </p>
                    </div>

                    <div className="sidebar-footer" style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                        <button
                            onClick={onLogout}
                            className="sidebar-logout-btn"
                        >
                            <ArrowRight size={16} style={{ transform: 'rotate(180deg)' }} />
                            <span>Log Out & Return</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="auth-main">
                <div className="auth-content">
                    <div className="auth-header">
                        <h1 className="auth-title">
                            {step === 'recovery' ? 'Recovery Codes' : 'Set Up 2FA'}
                        </h1>
                        <p className="auth-subtitle">
                            {step === 'recovery'
                                ? 'Store these codes securely. They are your last resort.'
                                : 'Secure your account with authenticator-based 2FA'}
                        </p>
                    </div>

                    {error && (
                        <div className="alert-box error">
                            <span className="alert-icon"><AlertTriangle size={20} /></span>
                            <span className="alert-message">{error}</span>
                        </div>
                    )}

                    {step === 'loading' && !error && (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <span className="spinner" style={{ display: 'inline-block', width: 40, height: 40 }}></span>
                            <p style={{ marginTop: '1rem', color: '#666' }}>Initializing 2FA setup...</p>
                        </div>
                    )}

                    {step === 'error' && (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <AlertTriangle size={48} color="#ef4444" />
                            <p style={{ marginTop: '1rem', color: '#374151', fontWeight: 600 }}>{error}</p>
                            <button 
                                className="submit-button" 
                                style={{ marginTop: '1.5rem' }} 
                                onClick={initSetup}
                                disabled={loading}
                            >
                                <span>{loading ? 'Retrying...' : 'Try Again'}</span>
                                <span className="button-icon"><ArrowRight size={18} /></span>
                            </button>
                        </div>
                    )}

                    {step === 'done' && (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <CheckCircle size={48} color="#22c55e" />
                            <p style={{ marginTop: '1rem', color: '#374151', fontWeight: 600 }}>2FA is already enabled on your account.</p>
                            <button className="submit-button" style={{ marginTop: '1.5rem' }} onClick={handleFinish}>
                                <span>Go to Dashboard</span>
                                <span className="button-icon"><ArrowRight size={18} /></span>
                            </button>
                        </div>
                    )}

                    {step === 'scan' && renderScanStep()}
                    {step === 'recovery' && renderRecoveryStep()}
                </div>
            </div>
        </div >
    );
}

export default TwoFactorSetup;
