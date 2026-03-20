import React, { useState } from 'react';
import { feedbacksAPI } from '../../services/api';
import { X, MessageSquarePlus } from 'lucide-react';
import '../../styles/Feedbacks.css';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

const MAX_FEEDBACK_LENGTH = 1000;
const MIN_FEEDBACK_LENGTH = 10;

const analyzeFeedback = (text) => {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words);
    const uniqueRatio = words.length ? uniqueWords.size / words.length : 0;
    const compact = normalized.replace(/\s+/g, '');
    const uniqueCharRatio = compact.length ? (new Set(compact.split('')).size / compact.length) : 1;
    const longestToken = words.reduce((max, w) => Math.max(max, w.length), 0);
    const hasWhitespace = /\s/.test(normalized);
    const urlCount = (normalized.match(/https?:\/\/|www\./gi) || []).length;
    const repeatedChar = /(.)\1{6,}/.test(normalized);
    const nonAlphaRatio = normalized.length
        ? (normalized.replace(/[a-z0-9\s]/gi, '').length / normalized.length)
        : 0;
    const wordFrequency = words.reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
    }, {});
    const maxWordFrequency = Object.values(wordFrequency).reduce((max, count) => Math.max(max, count), 0);
    const maxWordRatio = words.length ? maxWordFrequency / words.length : 0;

    const reasons = [];
    if (normalized.length < MIN_FEEDBACK_LENGTH) reasons.push('too_short');
    if (words.length > 6 && uniqueRatio < 0.4) reasons.push('low_variance');
    if (urlCount >= 2) reasons.push('too_many_links');
    if (repeatedChar) reasons.push('repeated_chars');
    if (nonAlphaRatio > 0.45) reasons.push('symbol_heavy');
    if (!hasWhitespace && normalized.length >= 40 && longestToken >= 40) reasons.push('long_unbroken_token');
    if (normalized.length >= 40 && uniqueCharRatio < 0.2) reasons.push('low_char_diversity');
    if (words.length >= 5 && maxWordRatio >= 0.5) reasons.push('repeated_word');

    const isSpam = reasons.includes('too_many_links') || reasons.length >= 2;
    return { isSpam, reasons };
};

function FeedbackModal({ onClose, onSuccess, transactionMeta }) {
    useLockBodyScroll(true);
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [softWarning, setSoftWarning] = useState('');

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
            setSoftWarning('');
            await feedbacksAPI.create({
                content: normalized,
                ...(transactionMeta?.transactionId ? { transactionId: transactionMeta.transactionId } : {}),
                ...(transactionMeta?.transactionRef ? { transactionRef: transactionMeta.transactionRef } : {})
            });
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
        <div className="modal-overlay feedback-modal-overlay">
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
                    {softWarning && <div className="soft-warning-message">{softWarning}</div>}

                    {transactionMeta && (
                        <div className="transaction-context">
                            <div className="context-title">Transaction Feedback</div>
                            <div className="context-row">
                                <span className="context-label">Transaction ID</span>
                                <span className="context-value">{transactionMeta.transactionId || transactionMeta.transactionRef}</span>
                            </div>
                            {transactionMeta.agency && (
                                <div className="context-row">
                                    <span className="context-label">Agency</span>
                                    <span className="context-value">{transactionMeta.agency}</span>
                                </div>
                            )}
                            {transactionMeta.programName && (
                                <div className="context-row">
                                    <span className="context-label">Program</span>
                                    <span className="context-value">{transactionMeta.programName}</span>
                                </div>
                            )}
                            {transactionMeta.amount !== undefined && (
                                <div className="context-row">
                                    <span className="context-label">Amount</span>
                                    <span className="context-value">PHP {Number(transactionMeta.amount || 0).toLocaleString()}</span>
                                </div>
                            )}
                            {transactionMeta.transactionType && (
                                <div className="context-row">
                                    <span className="context-label">Type</span>
                                    <span className="context-value">{transactionMeta.transactionType}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="content">What's on your mind? Share your feedback, suggestion, or query.</label>
                        <textarea
                            id="content"
                            className="feedback-textarea"
                            placeholder="Write your message here..."
                            value={content}
                            onChange={(e) => {
                                const next = e.target.value;
                                setContent(next);
                                if (error) setError('');
                                const scan = analyzeFeedback(next);
                                setSoftWarning(scan.isSpam ? 'This message looks spammy. It may be rejected by our spam filter.' : '');
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
                        <button
                            type="submit"
                            className="btn-submit"
                            disabled={isSubmitting || !content.trim()}
                        >
                            {isSubmitting ? 'Posting...' : 'Post Message'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default FeedbackModal;
