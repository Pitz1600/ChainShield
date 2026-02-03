import React, { useState } from 'react';
import { Star, Send, CheckCircle, XCircle } from 'lucide-react';
import '../../styles/SubmitFeedback.css';

function SubmitFeedback({ transaction, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        actualFraud: null,
        confidence: 3,
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.actualFraud === null) {
            setError('Please select whether this is fraud or not');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/feedback', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transactionId: transaction._id,
                    actualFraud: formData.actualFraud,
                    actualCategory: formData.actualFraud ? 'Procurement Anomaly' : 'Not Fraud',
                    confidence: formData.confidence,
                    notes: formData.notes
                })
            });

            if (response.ok) {
                const data = await response.json();
                alert('✅ Feedback submitted successfully! Admin will review it.');
                if (onSuccess) onSuccess();
                if (onClose) onClose();
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to submit feedback');
            }
        } catch (err) {
            setError('Error submitting feedback: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="feedback-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Submit Feedback</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Transaction Summary */}
                    <div className="transaction-summary">
                        <h4>Transaction Details</h4>
                        <div className="detail-row">
                            <span>Amount:</span>
                            <strong>₱{transaction.amount?.toLocaleString()}</strong>
                        </div>
                        <div className="detail-row">
                            <span>Type:</span>
                            <strong>{transaction.transactionType}</strong>
                        </div>
                        <div className="detail-row">
                            <span>AI Risk Score:</span>
                            <strong className={`risk-${transaction.riskLevel?.toLowerCase()}`}>
                                {transaction.riskScore} ({transaction.riskLevel})
                            </strong>
                        </div>
                    </div>

                    {/* Feedback Form */}
                    <form onSubmit={handleSubmit}>
                        {/* Fraud Decision */}
                        <div className="form-group">
                            <label className="form-label">Your Assessment *</label>
                            <div className="decision-buttons">
                                <button
                                    type="button"
                                    className={`decision-btn fraud ${formData.actualFraud === true ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, actualFraud: true })}
                                >
                                    <XCircle size={20} />
                                    This is FRAUD
                                </button>
                                <button
                                    type="button"
                                    className={`decision-btn not-fraud ${formData.actualFraud === false ? 'active' : ''}`}
                                    onClick={() => setFormData({ ...formData, actualFraud: false })}
                                >
                                    <CheckCircle size={20} />
                                    This is NOT FRAUD
                                </button>
                            </div>
                        </div>

                        {/* Confidence Level */}
                        <div className="form-group">
                            <label className="form-label">
                                Confidence Level: {formData.confidence}/5
                            </label>
                            <div className="confidence-stars">
                                {[1, 2, 3, 4, 5].map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        className="star-btn"
                                        onClick={() => setFormData({ ...formData, confidence: level })}
                                    >
                                        <Star
                                            size={32}
                                            fill={level <= formData.confidence ? '#fbbf24' : 'none'}
                                            color={level <= formData.confidence ? '#fbbf24' : '#cbd5e1'}
                                        />
                                    </button>
                                ))}
                            </div>
                            <div className="confidence-labels">
                                <span>Low</span>
                                <span>High</span>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="form-group">
                            <label className="form-label">Notes (Optional)</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Explain your reasoning, evidence found, or investigation notes..."
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                                maxLength={1000}
                            />
                            <div className="char-count">{formData.notes.length}/1000</div>
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            className="submit-btn"
                            disabled={submitting || formData.actualFraud === null}
                        >
                            {submitting ? (
                                <>Submitting...</>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Submit Feedback
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default SubmitFeedback;
