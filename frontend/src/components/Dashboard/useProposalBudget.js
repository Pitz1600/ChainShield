import { useEffect, useState } from 'react';
import api from '../../services/api';

export const proposalMoney = cents => cents == null ? 'Not recorded' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);

export function useProposalBudget() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [result, setResult] = useState(null), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(''); setLoading(true);
    api.get(`/annual-budgets/${year}`, { signal: controller.signal }).then(r => {
      if (!controller.signal.aborted) setResult({ ...r.data, year: String(year) });
    }).catch(e => {
      if (!controller.signal.aborted) setError(e.response?.data?.error || 'Unable to load the annual proposal budget. Please retry.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [year, revision]);
  useEffect(() => {
    const timer = setInterval(() => setRevision(r => r + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  return { year, setYear, data: result?.year === String(year) ? result : null, error, loading, refresh: () => setRevision(r => r + 1) };
}

