import React, { useState, useEffect } from 'react';
import { Users, User, MessageSquare, CheckCircle, Clock, Edit2, X, Activity, Mail, Shield } from 'lucide-react';
import { isAdmin } from '../../utils/permissions';
import UserManagement from './UserManagement';
import FeedbackReview from './FeedbackReview';
import SecurityLogs from './SecurityLogs';
import '../../styles/AdminPanel.css';

function AdminPanel({ user }) {
    // Permission check - only admins can access
    if (!isAdmin(user)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
                    <h2 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Access Denied</h2>
                    <p style={{ color: '#7f1d1d' }}>
                        Admin Panel is only accessible to Administrators.
                    </p>
                    <p style={{ color: '#991b1b', fontSize: '0.875rem', marginTop: '1rem' }}>
                        Your role: <strong>{user?.role || 'Unknown'}</strong>
                    </p>
                </div>
            </div>
        );
    }

    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, pendingVerification: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('security');

    useEffect(() => {
        // Load everything on mount
        fetchUsers();
        fetchStats();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            } else if (response.status === 403) {
                setError('You do not have permission to view users');
            } else {
                setError('Failed to load users');
            }
        } catch (err) {
            setError('Error loading users: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/admin/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats(data.stats); // Fix: Access the stats property
            } else {
                setError('Failed to load statistics');
            }
        } catch (err) {
            setError('Error loading stats: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // -- Edit Modal Logic --
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editFormData, setEditFormData] = useState({
        username: '',
        userId: '',
        email: '',
        role: 'resident',
        position: '',
        isActive: true,
        isVerified: false
    });

    const handleEditUser = (user) => {
        setEditingUser(user);
        setEditFormData({
            userId: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            position: user.position || '',
            isActive: user.isActive,
            isVerified: user.isVerified
        });
        setIsEditModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/admin/users/${editFormData.userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: editFormData.username,
                    role: editFormData.role,
                    position: editFormData.position,
                    isActive: editFormData.isActive,
                    isVerified: editFormData.isVerified
                })
            });

            if (response.ok) {
                // Determine if we should send a separate notification or just refresh
                // For now, just refresh
                await fetchUsers();
                await fetchStats(); // Stats might change (e.g. verified count)
                setIsEditModalOpen(false);
                setEditingUser(null);
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to update user');
            }
        } catch (err) {
            alert('Error updating user: ' + err.message);
        }
    };


    return (
        <div className="admin-panel">
            <div className="page-hero admin-hero">
                <div>
                    <span className="hero-tag">ADMIN PANEL</span>
                    <h2 className="hero-title">System Administration</h2>
                    <p className="hero-subtitle">Manage users, roles, permissions, and monitor system statistics.</p>
                </div>
                <div className="hero-stats">
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{stats.totalUsers || 0}</span>
                        <span className="hero-stat-label">Total Users</span>
                    </div>
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{stats.activeUsers || 0}</span>
                        <span className="hero-stat-label">Active</span>
                    </div>
                    <div className="hero-stat-item">
                        <span className="hero-stat-value">{stats.pendingVerification || 0}</span>
                        <span className="hero-stat-label">Pending</span>
                    </div>
                </div>
            </div>

            <div className="admin-content-wrapper">
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
                    <button
                        onClick={() => setActiveTab('security')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'security' ? '2px solid #667eea' : '2px solid transparent',
                            color: activeTab === 'security' ? '#667eea' : '#6b7280',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Shield size={18} style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                        Security Logs
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            background: 'none',
                            border: 'none',
                            borderBottom: activeTab === 'users' ? '2px solid #667eea' : '2px solid transparent',
                            color: activeTab === 'users' ? '#667eea' : '#6b7280',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Users size={18} style={{ display: 'inline-block', marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
                        User Management
                    </button>
                </div>

                <div className="admin-content">
                    {activeTab === 'users' && (
                        <>
                            {loading && (
                                <div style={{ padding: '3rem', textAlign: 'center' }}>
                                    <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                                    <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading...</p>
                                </div>
                            )}

                            {error && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                                    {error}
                                </div>
                            )}

                            {!loading && !error && (
                                <div className="users-table-container">
                                    <h3 style={{ margin: '0 0 1.5rem', color: '#334155', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Users size={24} className="text-blue-500" />
                                        User Management
                                    </h3>
                            <div className="user-card-header" style={{ display: 'grid', gridTemplateColumns: '2fr 2.5fr 1.5fr 1fr 1fr auto', padding: '0 1.25rem 0.5rem', fontWeight: '600', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                                <div>User</div>
                                <div>Contact</div>
                                <div>Role</div>
                                <div>Status</div>
                                <div>KYC</div>
                                <div>Actions</div>
                            </div>

                            {users.map((u) => (
                                <div key={u._id} className="user-card-row">
                                    <div className="user-info-cell">
                                        <div className="user-main-text" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Users size={16} color="#64748b" />
                                            </div>
                                            {u.username}
                                        </div>
                                        <div className="user-sub-text">ID: {u._id.slice(-6)}</div>
                                    </div>

                                    <div className="user-info-cell">
                                        <div className="user-main-text" style={{ fontSize: '0.9rem' }}>{u.email}</div>
                                        <div className="user-sub-text">
                                            Joined: {new Date(u.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>

                                    <div className="user-info-cell">
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.25rem',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '99px',
                                            fontSize: '0.8rem',
                                            fontWeight: '600',
                                            background: u.role === 'administrator' ? '#f0f9ff' : u.role === 'barangay_official' ? '#fdf4ff' : '#f8fafc',
                                            color: u.role === 'administrator' ? '#0369a1' : u.role === 'barangay_official' ? '#a21caf' : '#475569',
                                            border: '1px solid transparent',
                                            borderColor: u.role === 'administrator' ? '#bae6fd' : u.role === 'barangay_official' ? '#f0abfc' : '#e2e8f0'
                                        }}>
                                            {u.role === 'administrator' ? <Shield size={12} /> : <User size={12} />}
                                            {u.role.replace('_', ' ')}
                                        </span>
                                        {u.position && <div className="user-sub-text" style={{ marginTop: '4px', paddingLeft: '4px' }}>{u.position}</div>}
                                    </div>

                                    <div>
                                        <span className={`status-badge ${u.isActive ? 'active' : 'inactive'}`}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    <div>
                                        {u.isVerified ? (
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                <CheckCircle size={16} /> Verified
                                            </span>
                                        ) : (
                                            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: '600' }}>
                                                <Clock size={16} /> Pending
                                            </span>
                                        )}
                                    </div>

                                    <div>
                                        <button
                                            className="action-button"
                                            style={{ background: 'none', border: '1px solid #e2e8f0', color: '#475569' }}
                                            onClick={() => handleEditUser(u)}
                                        >
                                            <Edit2 size={16} style={{ marginRight: '6px' }} /> Edit
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                    )}
                        </>
                    )}

                    {activeTab === 'security' && (
                        <SecurityLogs />
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdminPanel;
