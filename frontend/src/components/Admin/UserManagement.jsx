import { rolePositionOptions } from '../../utils/rolePositions';
import useFieldErrors from '../../utils/useFieldErrors';
import { apiFieldErrors } from '../../utils/fieldValidation';
import TextField from '../Forms/TextField';
import React, { useState, useEffect } from 'react';
import { Users, User, CheckCircle, Clock, Edit2, X, Shield, Activity, Mail, Trash2 } from 'lucide-react';
import api from '../../services/api';
import '../../styles/AdminPanel.css';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

function UserManagement() {
  const [fieldErrors, setFieldErrors] = useFieldErrors();
    const managedRoleOptions = ['barangay_official', 'auditor', 'administrator'];
    const formatRoleLabel = (role) => String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const getDefaultPositionForRole = (role) => rolePositionOptions[role]?.[0] || '';
    const createRoleGuidance = {
        barangay_official: {
            tone: 'warning',
            title: 'Barangay Official account',
            text: 'Email OTP is required on every login. 2FA setup is mandatory.'
        },
        auditor: {
            tone: 'info',
            title: 'Auditor account',
            text: 'Email OTP is required on every login. 2FA setup is mandatory.'
        },
        administrator: {
            tone: 'critical',
            title: 'Administrator onboarding',
            text: 'User must change password, change email, and complete mandatory 2FA setup before full access.'
        },
    };
    const [users, setUsers] = useState([]);
    const [pendingOnly, setPendingOnly] = useState(false);
    const pendingUsers = users.filter(u => u.isApproved === false && u.isVerified && u.isActive);
    const reviewUser = async (user, approve) => {
        if (!window.confirm(approve ? `Approve ${user.email} as ${formatRoleLabel(user.role)}? Confirm their identity out-of-band before approving.` : `Reject ${user.email}? Their account will be deactivated.`)) return;
        const totpCode = approve ? window.prompt('Enter your current authenticator code') : undefined;
        if (approve && !totpCode) return;
        try { await api.put(`/admin/users/${user._id}/${approve ? 'approve' : 'deactivate'}`, { totpCode }); await fetchUsers(); await fetchStats(); }
        catch (err) {
      setFieldErrors(apiFieldErrors(err)); setError(err.response?.data?.error || 'Review failed'); }
    };
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
        role: 'barangay_official',
        position: '',
        isActive: true,
        isVerified: false
    });
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    useLockBodyScroll(isEditModalOpen || isCreateModalOpen);
    const [createFormData, setCreateFormData] = useState({
        firstName: '',
        lastName: '',
        birthday: '',
        email: '',
        role: 'barangay_official',
        position: getDefaultPositionForRole('barangay_official')
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
            const totpCode = window.prompt('Enter your current authenticator code to update access');
            if (!totpCode) return;
            await api.put(`/admin/users/${editFormData.userId}`, { ...editFormData, totpCode });
            setIsEditModalOpen(false);
            fetchUsers();
        } catch (err) {
      setFieldErrors(apiFieldErrors(err));
            setError(err.response?.data?.error || err.message);
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');
        try {
            const totpCode = window.prompt('Enter your current authenticator code to create this account');
            if (!totpCode) return;
            const payload = { ...createFormData, totpCode };
            await api.post('/admin/users', payload);
            setIsCreateModalOpen(false);
            setCreateFormData({
                firstName: '',
                lastName: '',
                birthday: '',
                email: '',
                role: 'barangay_official',
                position: getDefaultPositionForRole('barangay_official')
            });
            fetchUsers();
            fetchStats(); // Update stats
            setCreateSuccess('Temporary credentials emailed. The user must change their password and set up 2FA.');
        } catch (err) {
      setFieldErrors(apiFieldErrors(err));
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
      setFieldErrors(apiFieldErrors(err));
            setError(err.response?.data?.error || err.message);
        }
    };

    if (loading) return <div className="loading-spinner">Loading users...</div>;


    return (
        <div className="user-management">
            {error && <div className="operation-toast" role="alert">{error}<button type="button" onClick={() => setError(null)} aria-label="Dismiss error">Dismiss</button></div>}
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

                        <div className="hero-stat-info">
                            <span className="hero-stat-value">{stats.totalUsers}</span>
                            <span className="hero-stat-label">Total Users</span>
                        </div>
                    </div>

                    <div className="hero-stat-card">

                        <div className="hero-stat-info">
                            <span className="hero-stat-value">{stats.activeUsers}</span>
                            <span className="hero-stat-label">Active Users</span>
                        </div>
                    </div>

                    <div className="hero-stat-card">

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

            <div className="user-queue-tabs" role="group" aria-label="User queues">
                <button type="button" className="user-queue-button" aria-pressed={!pendingOnly} onClick={() => setPendingOnly(false)}>
                    <Users size={18} aria-hidden="true" />
                    All Users
                </button>
                <button type="button" className="user-queue-button" aria-pressed={pendingOnly} onClick={() => setPendingOnly(true)}>
                    <Clock size={18} aria-hidden="true" />
                    Pending Approvals
                    <span className="user-queue-count">{pendingUsers.length}</span>
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
                        {(pendingOnly ? pendingUsers : users).map(user => (
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
                                        {formatRoleLabel(user.role)}
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
                                             Verified
                                        </span>
                                    ) : (
                                        <span className="unverified-badge">
                                             Pending
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <div className="actions-cell">
                                        {user.isApproved === false && user.isVerified && user.isActive && <>
                                            <button type="button" className="user-review-button approve" onClick={() => reviewUser(user, true)}>
                                                <CheckCircle size={16} aria-hidden="true" /> Approve
                                            </button>
                                            <button type="button" className="user-review-button reject" onClick={() => reviewUser(user, false)}>
                                                <X size={16} aria-hidden="true" /> Reject
                                            </button>
                                        </>}
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
                                        <TextField error={fieldErrors["firstName"]} onEdit={() => setFieldErrors({})} field="firstName"
                                            type="text"
                                            className="form-input"
                                            value={editFormData.firstName}
                                            onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Last Name</label>
                                        <TextField error={fieldErrors["lastName"]} onEdit={() => setFieldErrors({})} field="lastName"
                                            type="text"
                                            className="form-input"
                                            value={editFormData.lastName}
                                            onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Birthday</label>
                                        <TextField error={fieldErrors["birthday"]} onEdit={() => setFieldErrors({})} field="birthday"
                                            type="date"
                                            className="form-input"
                                            value={editFormData.birthday}
                                            onChange={(e) => setEditFormData({ ...editFormData, birthday: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <TextField error={fieldErrors["email"]} onEdit={() => setFieldErrors({})} field="email"
                                            type="email"
                                            className="form-input"
                                            value={editFormData.email}
                                            readOnly
                                            title="Email cannot be changed here"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <TextField error={fieldErrors["role"]} onEdit={() => setFieldErrors({})} field="role" as="select"
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
                                        </TextField>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Position / Title</label>
                                        <TextField error={fieldErrors["position"]} onEdit={() => setFieldErrors({})} field="position" as="select"
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
                                        </TextField>
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
                                        <TextField error={fieldErrors["firstName"]} onEdit={() => setFieldErrors({})} field="firstName"
                                            type="text"
                                            className="form-input"
                                            value={createFormData.firstName}
                                            onChange={(e) => setCreateFormData({ ...createFormData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Last Name</label>
                                        <TextField error={fieldErrors["lastName"]} onEdit={() => setFieldErrors({})} field="lastName"
                                            type="text"
                                            className="form-input"
                                            value={createFormData.lastName}
                                            onChange={(e) => setCreateFormData({ ...createFormData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Birthday</label>
                                        <TextField error={fieldErrors["birthday"]} onEdit={() => setFieldErrors({})} field="birthday"
                                            type="date"
                                            className="form-input"
                                            value={createFormData.birthday}
                                            onChange={(e) => setCreateFormData({ ...createFormData, birthday: e.target.value })}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <TextField error={fieldErrors["email"]} onEdit={() => setFieldErrors({})} field="email"
                                            type="email"
                                            className="form-input"
                                            value={createFormData.email}
                                            onChange={(e) => setCreateFormData({ ...createFormData, email: e.target.value })}
                                            autoComplete="email"
                                            required
                                        />
                                    </div>
                                    <p>Temporary credentials will be emailed to the user.</p>
                                    <div className="form-group">
                                        <label className="form-label">Role</label>
                                        <TextField error={fieldErrors["role"]} onEdit={() => setFieldErrors({})} field="role" as="select"
                                            className="form-select"
                                            value={createFormData.role}
                                            onChange={(e) => handleCreateRoleChange(e.target.value)}
                                        >
                                            {managedRoleOptions.map((role) => (
                                                <option key={role} value={role}>
                                                    {role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                                </option>
                                            ))}
                                        </TextField>
                                    </div>
                                    <div className={`form-group full-width role-policy-hint ${createRoleGuidance[createFormData.role]?.tone || 'neutral'}`}>
                                        <div className="role-policy-title">{createRoleGuidance[createFormData.role]?.title || 'Role policy'}</div>
                                        <div className="role-policy-text">{createRoleGuidance[createFormData.role]?.text || ''}</div>
                                    </div>
                                    <div className="form-group full-width">
                                        <label className="form-label">Position / Title</label>
                                        <TextField error={fieldErrors["position"]} onEdit={() => setFieldErrors({})} field="position" as="select"
                                            className="form-select"
                                            value={createFormData.position}
                                            onChange={(e) => setCreateFormData({ ...createFormData, position: e.target.value })}
                                        >
                                            {(rolePositionOptions[createFormData.role] || ['']).map((position) => (
                                                <option key={position} value={position}>{position}</option>
                                            ))}
                                        </TextField>
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
