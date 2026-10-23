import { useState } from 'react';
import { CheckCircle, Clock, LogOut, RefreshCw } from 'lucide-react';
import '../../styles/Login.css';
import '../../styles/AuthCentered.css';
import '../../styles/PendingApproval.css';

export default function PendingApproval({ onCheck, onLogout }) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    try {
      await onCheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="auth-container auth-centered pending-approval-screen">
      <main className="auth-main">
        <div className="auth-content">
          <header className="auth-header pending-approval-header">
            <h1 className="auth-title">Waiting for approval</h1>
            <p className="auth-subtitle">Your account is awaiting administrator review</p>
          </header>
          <section className="auth-form pending-approval-card" aria-label="Account approval status">
            <div className="pending-approval-badge">
              <Clock size={16} aria-hidden="true" />
              Pending approval
            </div>
            <p className="pending-approval-description">
              Your email is verified. An administrator will review your requested role and position before you can access ChainShield.
            </p>
            <ol className="pending-approval-steps">
              <li>
                <CheckCircle size={20} className="pending-approval-complete" aria-hidden="true" />
                <div>
                  <strong>Email verified</strong>
                  <span>Your email address has been confirmed.</span>
                </div>
              </li>
              <li aria-current="step">
                <Clock size={20} className="pending-approval-current" aria-hidden="true" />
                <div>
                  <strong>Administrator review</strong>
                  <span>Your requested role and position are awaiting approval.</span>
                </div>
              </li>
            </ol>
            <button type="button" className="submit-button pending-approval-check" disabled={checking} onClick={handleCheck}>
              {checking ? <span className="spinner" aria-hidden="true" /> : <RefreshCw size={18} aria-hidden="true" />}
              <span role="status">{checking ? 'Checking status…' : 'Check status'}</span>
            </button>
            <button type="button" className="pending-approval-logout" onClick={onLogout}>
              <LogOut size={18} aria-hidden="true" />
              Log out
            </button>
            <p className="pending-approval-note">Check your status again after an administrator has reviewed your account.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
