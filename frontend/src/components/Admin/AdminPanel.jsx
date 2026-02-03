import React, { useState } from 'react';
import { Users, MessageSquare } from 'lucide-react';
import { isAdmin } from '../../utils/permissions';
import UserManagement from './UserManagement';
import FeedbackReview from './FeedbackReview';
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

    const [activeTab, setActiveTab] = useState('users');

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
                    className={`tab-button ${activeTab === 'feedback' ? 'active' : ''}`}
                    onClick={() => setActiveTab('feedback')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <MessageSquare size={18} />
                    Feedback Review
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'users' && <UserManagement user={user} />}
            {activeTab === 'feedback' && <FeedbackReview user={user} />}
        </div>
    );
}

export default AdminPanel;
