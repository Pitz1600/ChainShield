import React, { useState, useEffect } from 'react';
import { Users, User, CheckCircle, Clock, Edit2, X, Shield, Activity, Mail, Trash2 } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';

function UserManagement() {
    const managedRoleOptions = ['resident', 'barangay_official', 'auditor', 'administrator'];
    const formatRoleLabel = (role) => String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const formatUserRoleDisplay = (user) => {
        if (user?.role === 'barangay_official' && user?.position) return user.position;
        return formatRoleLabel(user?.role);
    };
    const rolePositionOptions = {
        resident: ['Resident'],
        barangay_official: ['Barangay Captain', 'Barangay Secretary', 'Barangay Treasurer', 'Barangay Kagawad', 'Barangay Clerk'],
        auditor: ['Internal Auditor', 'Compliance Auditor', 'Financial Auditor'],
        administrator: ['System Administrator']
    };
    const getDefaultPositionForRole = (role) => rolePositionOptions[role]?.[0] || '';
    const createRoleGuidance = {
        resident: {
            tone: 'neutral',
            title: 'Resident account',
            text: 'Login uses email + password. OTP may be required on untrusted devices.'
        },
        barangay_official: {
            tone: 'warning',
            title: 'Barangay Official account',
            text: 'Email OTP is required on every login. 2FA setup is optional.'
        },
        auditor: {
            tone: 'info',
            title: 'Auditor account',
            text: 'Email OTP is required on every login. 2FA setup is optional.'
        },
        administrator: {
            tone: 'critical',
            title: 'Administrator onboarding',
            text: 'User must change password, change email, and complete mandatory 2FA setup before full access.'
        },
    };
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, pendingVerification: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editFormData, setEditFormData] = useState({
        firstName: '',
        lastName: '',
        birthday: '',
        userId: '',
        email: '',
        role: 'resident',
        position: '',
        isActive: true,
        isVerified: false
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        firstName: '',
        lastName: '',
        birthday: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'resident',
        position: getDefaultPositionForRole('resident')
    });
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        fetchUsers();
        fetchStats();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/users');
            setUsers(response.data.users || []);
        } catch (err) {
            if (err.response?.status === 403) {
                setError('You do not have permission to view users');
            } else {
                setError('Error loading users: ' + (err.response?.data?.error || err.message));
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/admin/stats');
            setStats(response.data.stats);
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setEditFormData({
            userId: user._id,
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            birthday: user.birthday ? new Date(user.birthday).toISOString().split('T')[0] : '',
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
            await api.put(`/admin/users/${editFormData.userId}`, editFormData);
            setIsEditModalOpen(false);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');
        if (createFormData.password !== createFormData.confirmPassword) {
            setCreateError('Passwords do not match.');
            return;
        }
        try {
            const payload = { ...createFormData };
            delete payload.confirmPassword;
            await api.post('/admin/users', payload);
            setIsCreateModalOpen(false);
            setCreateFormData({
                firstName: '',
                lastName: '',
                birthday: '',
                email: '',
                password: '',
                confirmPassword: '',
                role: 'resident',
                position: getDefaultPositionForRole('resident')
            });
            fetchUsers();
            fetchStats(); // Update stats
            setCreateSuccess('User created successfully. Ask the user to log in and complete first-password onboarding.');
        } catch (err) {
            setCreateError(err.response?.data?.error || err.message);
        }
    };

    const handleCreateRoleChange = (nextRole) => {
        setCreateFormData({
            ...createFormData,
            role: nextRole,
            position: getDefaultPositionForRole(nextRole)
        });
    };

    const handleEditRoleChange = (nextRole) => {
        const keepPosition = rolePositionOptions[nextRole]?.includes(editFormData.position);
        setEditFormData({
            ...editFormData,
            role: nextRole,
            position: keepPosition ? editFormData.position : getDefaultPositionForRole(nextRole)
        });
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await api.delete(`/admin/users/${userId}`);
            fetchUsers();
            fetchStats(); // Update stats
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
    };

    if (loading) return <div className="loading-spinner">Loading users...</div>;
    if (error) return <div className="error-message">{error}</div>;

    return (
        <div className="user-management">
            {/* Unified Hero Banner */}
            <div className="admin-hero">
                <div className="hero-text-section">
                    <div className="hero-label">User Management Workspace</div>
                    <h1 className="hero-title">Welcome back, Admin!</h1>
                    <p className="hero-description">
                        Manage user accounts, roles, and verification status.
                        Maintain a secure and organized community directory.
                    </p>
                </div>

                <div className="hero-stats-row">
                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                            <Users size={24} />
                        </div>
                        <div className="hero-stat-info">
                            <span className="hero-stat-value">{stats.totalUsers}</span>
                            <span className="hero-stat-label">Total Users</span>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>
                            <Activity size={24} />
                        </div>
                        <div className="hero-stat-info">
                            <span className="hero-stat-value">{stats.activeUsers}</span>
                            <span className="hero-stat-label">Active Users</span>
                        </div>
                    </div>

                    <div className="hero-stat-card">
                        <div className="hero-stat-icon" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>
                            <Clock size={24} />
                        </div>
                        <div className="hero-stat-info">
                            <span className="hero-stat-value">{stats.pendingVerification}</span>
                            <span className="hero-stat-label">Pending</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Header Actions */}
            <div className="section-header">
                <h2>User Directory ({users.length})</h2>
                <button
                    className="btn-primary"
                    onClick={() => setIsCreateModalOpen(true)}
                    style={{ marginLeft: 'auto' }}
                >
                    <User size={16} style={{ marginRight: '0.5rem' }} />
                    Create User
                </button>
            </div>
            {createSuccess && (
                <div className="success-banner" style={{ marginBottom: '1rem' }}>
                    {createSuccess}
                </div>
            )}

            {/* Users Table */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Contact</th>
                            <th>Verified</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user._id}>
                                <td>
                                    <div className="user-cell">
                                        <div className="avatar-circle">
                                            {user.firstName?.charAt(0) || user.username?.charAt(0)}
                                        </div>
                                        <div className="user-info">
                                            <span className="user-name">{user.firstName} {user.lastName}</span>
                                            <span className="user-sub">{user.position}</span>
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`role-badge ${user.role}`}>
                                        {formatUserRoleDisplay(user)}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-badge ${user.isActive ? 'active' : 'inactive'}`}>
                                        {user.isActive ? 'Active' : 'Deactivated'}
                                    </span>
                                </td>
                                <td>{user.email}</td>
                                <td>
                                    {user.isVerified ? (
                                        <span className="verified-badge">
                                            <CheckCircle size={14} /> Verified
                                        </span>
                                    ) : (
                                        <span className="unverified-badge">
                                            <Clock size={14} /> Pending
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <div className="actions-cell">
                                        <button
                                            className="icon-btn edit"
                                            onClick={() => handleEditUser(user)}
                                            title="Edit User"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="icon-btn delete"
                                            onClick={() => handleDeleteUser(user._id)}
                                            title="Delete User"
                                            disabled={currentUser.id === user._id}
                                            style={{ opacity: currentUser.id === user._id ? 0.5 : 1, cursor: currentUser.id === user._id ? 'not-allowed' : 'pointer' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit User Modal */}
            {isEditModalOpen && (
                <div className="modal-overlay">
                    <div className="edit-modal create-user-modal">
                        <div className="modal-header">
                            <h3>Edit User</h3>
                            <button className="close-modal-btn" onClick={() => setIsEditModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content">
                            <form onSubmit={handleSaveUser}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">First Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editFormData.firstName}
                                            onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Last Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editFormData.lastName}
                                            onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Birthday</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={editFormData.birthday}
                                            onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={editFormData.email}
                                            readOnly
                                            title="Email cannot be changed here"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <select
                                            className="form-select"
                                            value={editFormData.role}
                                            onChange={(e) => handleEditRoleChange(e.target.value)}
                                            disabled={editingUser && (editingUser._id === currentUser.id || editingUser.role === 'administrator')}
                                        >
                                            {managedRoleOptions
                                                .filter((role) => role !== 'administrator' || editFormData.role === 'administrator')
                                                .map((role) => (
                                                <option key={role} value={role}>
                                                    {role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Position / Title</label>
                                        <select
                                            className="form-select"
                                            value={editFormData.position}
                                            onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                        >
                                            {[
                                                ...(rolePositionOptions[editFormData.role] || []),
                                                ...((editFormData.position && !(rolePositionOptions[editFormData.role] || []).includes(editFormData.position)) ? [editFormData.position] : [])
                                            ].map((position) => (
                                                <option key={position} value={position}>{position}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-save">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className="modal-overlay">
                    <div className="edit-modal create-user-modal">
                        <div className="modal-header">
                            <h3>Create New User</h3>
                            <button className="close-modal-btn" onClick={() => setIsCreateModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content">
                            {createError && (
                                <div className="error-banner" style={{ margin: '0 1.5rem 1rem' }}>
                                    {createError}
                                </div>
                            )}
                            <form onSubmit={handleCreateUser}>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label className="form-label">First Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={createFormData.firstName}
                                            onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Last Name</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={createFormData.lastName}
                                            onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Birthday</label>
                                        <input
                                            type="date"
                                            className="form-input"
                                            value={createFormData.birthday}
                                            onChange={(e) => setCreateFormData({ ...createFormData, birthday: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={createFormData.email}
                                            onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={createFormData.password}
                                            onChange={(e) => setCreateFormData({ ...createFormData, password: e.target.value })}
                                            autoComplete="new-password"
                                            required
                                            minLength={8}
                                        />
                                        <div className="form-hint">Minimum 8 chars, uppercase, lowercase, number, and special character.</div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Confirm Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={createFormData.confirmPassword}
                                            onChange={(e) => setCreateFormData({ ...createFormData, confirmPassword: e.target.value })}
                                            autoComplete="new-password"
                                            required
                                            minLength={8}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <select
                                            className="form-select"
                                            value={createFormData.role}
                                            onChange={(e) => handleCreateRoleChange(e.target.value)}
                                        >
                                            {managedRoleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={`form-group full-width role-policy-hint ${createRoleGuidance[createFormData.role]?.tone || 'neutral'}`}>
                                        <div className="role-policy-title">{createRoleGuidance[createFormData.role]?.title || 'Role policy'}</div>
                                        <div className="role-policy-text">{createRoleGuidance[createFormData.role]?.text || ''}</div>
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="form-label">Position / Title</label>
                                        <select
                                            className="form-select"
                                            value={createFormData.position}
                                            onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                        >
                                            {(rolePositionOptions[createFormData.role] || ['']).map((position) => (
                                                <option key={position} value={position}>{position}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn-cancel" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn-save">Create User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
