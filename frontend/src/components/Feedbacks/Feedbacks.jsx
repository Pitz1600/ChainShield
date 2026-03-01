import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, Send, Reply, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Feedbacks.css';

function Feedbacks({ user }) {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchFeedbacks();
    }, [searchQuery]);

    const fetchFeedbacks = async () => {
        try {
            setLoading(true);
            const response = await api.get('/feedback', {
                params: { search: searchQuery }
            });
            setFeedbacks(response.data.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching feedback:', err);
            setError('Failed to load feedback. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddMessage = async (e) => {
        e.preventDefault();
        
        if (!newMessage.trim()) {
            return;
        }

        try {
            setSubmitting(true);
            await api.post('/feedback', { message: newMessage });
            setNewMessage('');
            await fetchFeedbacks();
        } catch (err) {
            console.error('Error adding message:', err);
            setError('Failed to post message. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleAddReply = async (feedbackId) => {
        if (!replyText.trim()) {
            return;
        }

        try {
            setSubmitting(true);
            await api.post(`/feedback/${feedbackId}/reply`, { message: replyText });
            setReplyText('');
            setReplyingTo(null);
            await fetchFeedbacks();
        } catch (err) {
            console.error('Error adding reply:', err);
            setError('Failed to post reply. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!window.confirm('Are you sure you want to delete this message?')) {
            return;
        }

        try {
            await api.delete(`/feedback/${feedbackId}`);
            await fetchFeedbacks();
        } catch (err) {
            console.error('Error deleting feedback:', err);
            setError('Failed to delete message. Please try again.');
        }
    };

    return (
        <div className="feedbacks-container">
            {/* Hero Header */}
            <div className="feedbacks-hero">
                <div className="hero-content">
                    <span className="hero-tag">COMMUNITY FEEDBACKS</span>
                    <h2 className="hero-title">Share your thoughts and suggestions</h2>
                    <p className="hero-subtitle">Connect with the community and officials to improve our services</p>
                </div>
            </div>

            {/* Content Section */}
            <div className="feedbacks-content">
                {/* Add Message Section */}
                <div className="add-message-section">
                    <div className="add-message-card">
                        <form onSubmit={handleAddMessage} className="add-message-form">
                            <textarea
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Share your feedback, suggestions, or concerns..."
                                className="message-textarea-large"
                                rows="5"
                                maxLength="2000"
                                disabled={submitting}
                            />
                            <button 
                                type="submit" 
                                className="btn-add-message"
                                disabled={!newMessage.trim() || submitting}
                            >
                                <Send size={16} />
                                {submitting ? 'Posting...' : 'Post Message'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="search-section">
                    <div className="search-box">
                        <Search size={20} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search messages..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="error-message">
                        <AlertCircle size={18} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Messages List */}
                <div className="messages-section">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Loading messages...</p>
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="empty-state">
                            <MessageSquare size={48} />
                            <h3>No messages yet</h3>
                            <p>Be the first to share your feedback!</p>
                        </div>
                    ) : (
                        <div className="messages-list">
                            {feedbacks.map((feedback) => (
                                <div key={feedback._id} className="message-card">
                                    <div className="message-header">
                                        <div className="user-name-bold">{feedback.userName}</div>
                                        <span className="message-time">
                                            {new Date(feedback.createdAt).toLocaleString('en-US', {
                                                month: '2-digit',
                                                day: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false
                                            })}
                                        </span>
                                    </div>

                                    <div className="message-body">
                                        <p>{feedback.message}</p>
                                    </div>

                                    {/* Replies Section */}
                                    {feedback.replies && feedback.replies.length > 0 && (
                                        <div className="replies-section">
                                            <div className="replies-label">Replies:</div>
                                            {feedback.replies.map((reply) => (
                                                <div key={reply._id} className="reply-card">
                                                    <div className="reply-header">
                                                        <div className="user-name-bold">{reply.userName}</div>
                                                        <span className="message-time">
                                                            {new Date(reply.createdAt).toLocaleString('en-US', {
                                                                month: '2-digit',
                                                                day: '2-digit',
                                                                year: 'numeric',
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                                hour12: false
                                                            })}
                                                        </span>
                                                    </div>
                                                    <div className="reply-body">
                                                        <p>{reply.message}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Reply Form or Button */}
                                    {replyingTo === feedback._id ? (
                                        <div className="reply-form">
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write your reply..."
                                                className="reply-textarea"
                                                rows="3"
                                                maxLength="2000"
                                                disabled={submitting}
                                                autoFocus
                                            />
                                            <div className="reply-actions">
                                                <button
                                                    onClick={() => {
                                                        setReplyingTo(null);
                                                        setReplyText('');
                                                    }}
                                                    className="btn-cancel"
                                                    disabled={submitting}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleAddReply(feedback._id)}
                                                    className="btn-send-reply"
                                                    disabled={!replyText.trim() || submitting}
                                                >
                                                    <Send size={16} />
                                                    {submitting ? 'Sending...' : 'Send Reply'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setReplyingTo(feedback._id)}
                                            className="btn-reply-trigger"
                                        >
                                            <Reply size={16} />
                                            Reply
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Feedbacks;
