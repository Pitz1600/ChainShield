import { useState } from 'react';
export default function PendingApproval({ onCheck, onLogout }) {
  const [checking, setChecking] = useState(false);
  return <div className="auth-container"><main className="auth-content">
    <h1>Waiting for administrator approval</h1>
    <p>Your email is verified. An administrator will review your requested role and position before you can access ChainShield.</p>
    <button disabled={checking} onClick={async () => { setChecking(true); try { await onCheck(); } finally { setChecking(false); } }}>Check status</button>
    <button onClick={onLogout}>Log out</button>
  </main></div>;
}
