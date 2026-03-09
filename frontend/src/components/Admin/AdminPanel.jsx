import React, { useState, useEffect } from 'react';
import { isAdmin } from '../../utils/permissions';
import UserManagement from './UserManagement';
import AuditLogViewer from './AuditLogViewer';
import UserSessionsTable from './UserSessionsTable';
import { Users, FileText, Activity } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState('users');

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
            {/* Tabs */}
            <div className="admin-tabs">
                <button
                    className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Users size={18} />
                    User Management
                </button>
                <button
                    className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
                    onClick={() => setActiveTab('audit')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <FileText size={18} />
                    Audit Logs
                </button>
                <button
                    className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Activity size={18} />
                    User Sessions
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'users' && <UserManagement user={user} />}
            {activeTab === 'audit' && <AuditLogViewer user={user} />}
            {activeTab === 'sessions' && <UserSessionsTable />}
        </div>
    );
}

export default AdminPanel;

