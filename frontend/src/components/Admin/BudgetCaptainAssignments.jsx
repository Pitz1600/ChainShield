import { useState } from 'react';
import api, { budgetProposalsAPI as proposals } from '../../services/api';
import '../BudgetProposals/BudgetProposalForm.css';

export default function BudgetCaptainAssignments() {
  const [users, setUsers] = useState([]);
  const [assignment, setAssignment] = useState({ userId: '', enabled: true, totpCode: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  async function run(fn) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await fn(); } catch (e) { setError(e.response?.data?.error || e.message); } finally { setBusy(false); }
  }
  return <section className="budget-proposals">
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      <details><summary>Manage Captain submission access</summary><button disabled={busy} onClick={() => run(async () => setUsers((await api.get('/admin/users')).data.users.filter(u => u.role === 'barangay_official' && u.isApproved)))}>Load approved officials</button>
        <label>Captain<select value={assignment.userId} onChange={e => { const u = users.find(u => u._id === e.target.value); setAssignment({ ...assignment, userId: e.target.value, enabled: u?.submitBudgetProposals || false }); }}><option value="">Select official</option>{users.map(u => <option key={u._id} value={u._id}>{u.firstName} {u.lastName} ({u.email})</option>)}</select></label>
        <label className="bp-checkbox"><input type="checkbox" checked={assignment.enabled} onChange={e => setAssignment({ ...assignment, enabled: e.target.checked })} /> Allow Captain submissions</label>
        <label>Current authenticator code<input autoComplete="one-time-code" value={assignment.totpCode} onChange={e => setAssignment({ ...assignment, totpCode: e.target.value })} /></label>
        <button className="bp-primary" disabled={busy || !assignment.userId} onClick={() => run(async () => { await proposals.assign(assignment.userId, assignment); setAssignment({ ...assignment, totpCode: '' }); setNotice('Verified assignment saved.'); })}>Save assignment</button>
      </details>
  </section>;
}
