import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';

function UserSessionsTable() {
    const [presence, setPresence] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchPresence = async () => {
        setLoading(true);
        setError('');
        try {
            const response = await api.get('/admin/audit-logs', {
                params: { page: 1, limit: 1, days: 7 }
            });
            const data = response.data || {};
            setPresence(Array.isArray(data.presence) ? data.presence : []);
        } catch (err) {
            console.error('Error fetching session presence:', err);
            setError(err?.response?.data?.error || 'Failed to load user sessions.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPresence();
    }, []);

    const formatTimeAgo = (dateValue) => {
        if (!dateValue) return 'Never active';
        const ms = Date.now() - new Date(dateValue).getTime();
        if (ms < 60 * 1000) return 'Online now';
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return (presence || []).filter((p) => {
            if (statusFilter === 'online' && !p.isOnline) return false;
            if (statusFilter === 'offline' && p.isOnline) return false;
            if (!q) return true;
            return (
                String(p.username || '').toLowerCase().includes(q) ||
                String(p.email || '').toLowerCase().includes(q) ||
                String(p.role || '').toLowerCase().includes(q)
            );
        });
    }, [presence, search, statusFilter]);

    return (
        <div className="audit-log-viewer">
            <div className="filters-section" style={{ marginBottom: '1.25rem' }}>
                <div className="filter-group">
                    <label>Session Status:</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All</option>
                        <option value="online">Online Only</option>
                        <option value="offline">Offline Only</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>Search User:</label>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="Name, email, or role..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="filter-group" style={{ maxWidth: 180 }}>
                    <button className="btn-save" type="button" onClick={fetchPresence} style={{ width: '100%' }}>
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="no-logs" style={{ marginBottom: '1rem', color: '#b91c1c', borderColor: '#fecaca', background: '#fef2f2' }}>
                    {error}
                </div>
            )}

            {loading ? (
                <div className="loading">Loading sessions...</div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Last Seen</th>
                                <th>Last Logout</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', color: '#64748b' }}>No sessions found</td>
                                </tr>
                            ) : (
                                filtered.map((p) => (
                                    <tr key={p.userId}>
                                        <td className="sessions-user-cell">
                                            <div className="sessions-user-info">
                                                <span className="sessions-user-name">{p.username || 'Unknown User'}</span>
                                                <span className="sessions-user-email">{p.email || 'No email'}</span>
                                            </div>
                                        </td>
                                        <td>{String(p.role || 'resident').replace(/_/g, ' ')}</td>
                                        <td>
                                            <span className={`status-badge ${p.isOnline ? 'active' : 'inactive'}`}>
                                                {p.isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </td>
                                        <td>{formatTimeAgo(p.lastSeenAt)}</td>
                                        <td>{p.lastLogoutAt ? new Date(p.lastLogoutAt).toLocaleString() : '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UserSessionsTable;
