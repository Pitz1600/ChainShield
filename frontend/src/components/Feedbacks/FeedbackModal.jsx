import React, { useState } from 'react';
import { feedbacksAPI } from '../../services/api';
import { X, MessageSquarePlus } from 'lucide-react';

const MAX_FEEDBACK_LENGTH = 1000;

function FeedbackModal({ onClose, onSuccess }) {
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const normalized = content.trim();
        if (!normalized) {
            setError('Content cannot be empty');
            return;
        }
        if (normalized.length > MAX_FEEDBACK_LENGTH) {
            setError(`Please keep your feedback within ${MAX_FEEDBACK_LENGTH} characters.`);
            return;
        }

        try {
            setIsSubmitting(true);
            setError('');
            await feedbacksAPI.create({ content: normalized });
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
                            onChange={(e) => {
                                setContent(e.target.value);
                                if (error) setError('');
                            }}
                            disabled={isSubmitting}
                            rows={5}
                            autoFocus
                            maxLength={MAX_FEEDBACK_LENGTH}
                        />
                        <div className="character-count">
                            {content.length}/{MAX_FEEDBACK_LENGTH}
                        </div>
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
