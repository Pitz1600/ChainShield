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
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [akismetStatus, setAkismetStatus] = useState(null);
    const [cleanupState, setCleanupState] = useState({ running: false, message: '' });
    const canPost = ['resident', 'barangay_official', 'auditor'].includes(user?.role);
    const canModerate = isAdmin(user) || isOfficial(user);

    useEffect(() => {
        fetchFeedbacks();
        fetchAkismetStatus();
        const statusTimer = setInterval(() => {
            fetchAkismetStatus();
        }, 180000);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => clearInterval(statusTimer);
    }, [refreshTrigger]);

    const fetchFeedbacks = async () => {
        try {
            setLoading(true);
            const params = {
                ...(searchQuery ? { search: searchQuery } : {}),
                status: 'approved'
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

    const fetchAkismetStatus = async () => {
        try {
            const res = await feedbacksAPI.getAkismetStatus();
            setAkismetStatus(res.data);
        } catch (error) {
            console.error('Failed to fetch Akismet status:', error);
            setAkismetStatus({ enabled: false, valid: false, error: 'unavailable' });
        }
    };

    const handleCleanupSpam = async () => {
        if (!canModerate) return;
        if (!window.confirm('Delete existing spam posts and replies? This cannot be undone.')) {
            return;
        }
        try {
            setCleanupState({ running: true, message: '' });
            const res = await feedbacksAPI.cleanupSpam({});
            const { deletedFeedbacks, removedReplies } = res.data || {};
            setCleanupState({
                running: false,
                message: `Cleanup complete: ${deletedFeedbacks || 0} posts removed, ${removedReplies || 0} replies removed.`
            });
            triggerRefresh();
        } catch (error) {
            console.error('Spam cleanup failed:', error);
            setCleanupState({ running: false, message: 'Cleanup failed. Please try again.' });
        }
    };

    const getAkismetBadge = () => {
        if (!akismetStatus) return { text: 'Akismet: —', tone: 'unknown' };
        if (!akismetStatus.enabled) return { text: 'Akismet: Disabled', tone: 'unknown' };
        if (akismetStatus.enabled && akismetStatus.valid) return { text: 'Akismet: Active', tone: 'ok' };
        if (akismetStatus.enabled && !akismetStatus.valid) return { text: 'Akismet: Invalid Key', tone: 'warn' };
        return { text: 'Akismet: Error', tone: 'warn' };
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
                        {canPost && (
                            <button className="primary-btn" onClick={() => setIsModalOpen(true)}>
                                <Plus size={18} /> Leave Feedback
                            </button>
                        )}
                        {canModerate && (
                            <button className="ghost-btn" onClick={handleCleanupSpam} disabled={cleanupState.running}>
                                {cleanupState.running ? 'Cleaning Spam...' : 'Clean Spam Now'}
                            </button>
                        )}
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
                    <div className={`hero-stat akismet-status ${getAkismetBadge().tone}`}>
                        <span className="stat-label">Spam Shield</span>
                        <span className="stat-value small">{getAkismetBadge().text}</span>
                    </div>
                </div>
            </div>

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
                {cleanupState.message && (
                    <div className="akismet-note">
                        {cleanupState.message}
                    </div>
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

            {isModalOpen && canPost && (
                <FeedbackModal
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={triggerRefresh}
                />
            )}
        </div>
    );
}

export default Feedbacks;
