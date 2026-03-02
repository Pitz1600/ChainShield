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
            <div className="feedbacks-header">
                <div className="title-section">
                    <MessageSquare size={32} className="header-icon" />
                    <h1 className="page-title">Community Feedbacks</h1>
                </div>
                <p className="page-subtitle">Share your thoughts, read community posts, and engage with your barangay.</p>
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
