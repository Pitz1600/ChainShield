import React, { useState } from 'react';
import { feedbacksAPI } from '../../services/api';
import { X, MessageSquarePlus } from 'lucide-react';

function FeedbackModal({ onClose, onSuccess }) {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) {
            setError('Content cannot be empty');
            return;
        }

        try {
            setIsSubmitting(true);
            setError('');
            await feedbacksAPI.create({ content });
            onSuccess();
            onClose();
        } catch (err) {
            console.error('Failed to create feedback:', err);
            setError(err.response?.data?.error || 'Failed to post feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="feedback-modal">
                <div className="modal-header">
                    <div className="modal-title-group">
                        <MessageSquarePlus className="modal-icon" size={24} />
                        <h3>Create a Post</h3>
                    </div>
                    <button className="close-btn" onClick={onClose} disabled={isSubmitting}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="content">What's on your mind? Share your feedback, suggestion, or query.</label>
                        <textarea
                            id="content"
                            className="feedback-textarea"
                            placeholder="Write your message here..."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            disabled={isSubmitting}
                            rows={5}
                            autoFocus
                        />
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-submit" disabled={isSubmitting || !content.trim()}>
                            {isSubmitting ? 'Posting...' : 'Post Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default FeedbackModal;
