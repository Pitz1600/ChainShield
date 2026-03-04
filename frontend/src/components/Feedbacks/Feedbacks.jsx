import React, { useState, useEffect } from 'react';
import { feedbacksAPI } from '../../services/api';
import FeedbackCard from './FeedbackCard';
import FeedbackModal from './FeedbackModal';
import { Search, Plus, MessageSquare } from 'lucide-react';
import { isAdmin, isOfficial } from '../../utils/permissions';
import '../../styles/Feedbacks.css';

function Feedbacks({ user, initialTab = 'public' }) {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        fetchFeedbacks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshTrigger, activeTab]);

    const fetchFeedbacks = async () => {
        try {
            setLoading(true);
            const params = {
                ...(searchQuery ? { search: searchQuery } : {}),
                ...(activeTab === 'moderation' ? { status: 'pending' } : { status: 'approved' })
            };
            const response = await feedbacksAPI.getAll(params);
            setFeedbacks(response.data);
        } catch (error) {
            console.error('Failed to fetch feedbacks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setRefreshTrigger(prev => prev + 1);
    };

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
        <div className="feedbacks-page">
            <div className="feedbacks-hero">
                <div className="hero-left">
                    <span className="hero-tag">COMMUNITY FEEDBACK</span>
                    <h1 className="hero-title">What people are saying</h1>
                    <p className="hero-subtitle">Share insights, flag issues, and see how officials respond.</p>
                    <div className="hero-actions">
                        <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} /> Leave Feedback
                        </button>
                        <button className="ghost-btn" onClick={triggerRefresh}>
                            Refresh Feed
                        </button>
                    </div>
                </div>
                <div className="hero-right">
                    <div className="hero-stat">
                        <span className="stat-label">Active Posts</span>
                        <span className="stat-value">{feedbacks.length}</span>
                    </div>
                    <div className="hero-stat muted">
                        <span className="stat-label">Moderation Queue</span>
                        <span className="stat-value">{activeTab === 'moderation' ? feedbacks.length : '—'}</span>
                    </div>
                </div>
            </div>

            {(isAdmin(user) || isOfficial(user)) && (
                <div className="admin-tabs feedback-tabs">
                    <button
                        className={`tab-button ${activeTab === 'public' ? 'active' : ''}`}
                        onClick={() => setActiveTab('public')}
                    >
                        Public Feed
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'moderation' ? 'active' : ''}`}
                        onClick={() => setActiveTab('moderation')}
                    >
                        Moderation Desk
                    </button>
                </div>
            )}

            <div className="feedbacks-toolbar">
                <form className="search-bar" onSubmit={handleSearchSubmit}>
                    <Search size={20} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by keywords, names, or topics..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                    <button type="submit" className="search-btn">Search</button>
                </form>

                {!(isAdmin(user) || isOfficial(user)) && (
                    <button className="create-feedback-btn" onClick={() => setIsModalOpen(true)}>
                        <Plus size={20} />
                        <span>New Post</span>
                    </button>
                )}
            </div>

            <div className="feedbacks-content">
                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading feedbacks...</p>
                    </div>
                ) : feedbacks.length > 0 ? (
                    <div className="feedbacks-list">
                        {feedbacks.map(feedback => (
                            <FeedbackCard
                                key={feedback._id}
                                feedback={feedback}
                                currentUser={user}
                                onRefresh={triggerRefresh}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <MessageSquare size={48} className="empty-icon" />
                        <h3>No feedbacks found</h3>
                        <p>Try adjusting your search or create a new post to get started.</p>
                    </div>
                )}
            </div>

            {isModalOpen && (
                <FeedbackModal
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={triggerRefresh}
                />
            )}
        </div>
    );
}

export default Feedbacks;
