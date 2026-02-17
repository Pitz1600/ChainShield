import React, { useState, useEffect } from 'react';
import { Users, User, CheckCircle, Clock, Edit2, X, Shield, Activity, Mail, Trash2 } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, pendingVerification: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
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
        role: 'resident',
        position: ''
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
        try {
            await api.post('/admin/users', createFormData);
            setIsCreateModalOpen(false);
            setCreateFormData({
                firstName: '',
                lastName: '',
                birthday: '',
                email: '',
                password: '',
                role: 'resident',
                position: ''
            });
            fetchUsers();
            fetchStats(); // Update stats
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        }
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
                                        {user.role}
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
                    <div className="edit-modal">
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
                                            onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                                            disabled={editingUser && editingUser._id === currentUser.id}
                                        >
                                            <option value="resident">Resident</option>
                                            <option value="barangay_official">Barangay Official</option>
                                            <option value="administrator">Administrator</option>
                                            <option value="analyst">Analyst</option>
                                            <option value="investigator">Investigator</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Position / Title</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editFormData.position}
                                            onChange={(e) => setEditFormData({ ...editFormData, position: e.target.value })}
                                            placeholder="e.g. Captain, Secretary"
                                        />
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
                    <div className="edit-modal">
                        <div className="modal-header">
                            <h3>Create New User</h3>
                            <button className="close-modal-btn" onClick={() => setIsCreateModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-content">
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
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <select
                                            className="form-select"
                                            value={createFormData.role}
                                            onChange={(e) => setCreateFormData({ ...createFormData, role: e.target.value })}
                                        >
                                            <option value="resident">Resident</option>
                                            <option value="barangay_official">Barangay Official</option>
                                            <option value="administrator">Administrator</option>
                                            <option value="analyst">Analyst</option>
                                            <option value="investigator">Investigator</option>
                                        </select>
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="form-label">Position / Title</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={createFormData.position}
                                            onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                            placeholder="e.g. Captain, Secretary"
                                        />
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
