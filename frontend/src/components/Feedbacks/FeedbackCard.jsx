import React, { useState } from 'react';
import { feedbacksAPI } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';
import { MessageCircle, Edit2, Trash2, Send, X, AlertCircle, CheckCircle } from 'lucide-react';
import { isAdmin, isOfficial } from '../../utils/permissions';
import ConfirmModal from './ConfirmModal';

const MAX_FEEDBACK_LENGTH = 1000;
const MAX_REPLY_LENGTH = 300;
const FEEDBACK_PREVIEW_CHARS = 500;
const REPLY_PREVIEW_CHARS = 220;

function FeedbackCard({ feedback, currentUser, onRefresh }) {
    const transactionMeta = feedback.transactionMeta || {};
    const transactionId = transactionMeta.transactionId || feedback.transactionId || feedback.transactionRef;
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(feedback.content);
    const [showReplyForm, setShowReplyForm] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedbackError, setFeedbackError] = useState('');
    const [replyError, setReplyError] = useState('');
    const [expandedFeedback, setExpandedFeedback] = useState(false);
    const [expandedReplies, setExpandedReplies] = useState({});

    // Editing Replies state
    const [editingReplyId, setEditingReplyId] = useState(null);
    const [replyEditContent, setReplyEditContent] = useState('');

    // Modal states
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, id: null });
    const [approveModal, setApproveModal] = useState({ isOpen: false, type: null, id: null, actionType: null });

    const openDeleteModal = (type, id = null) => setDeleteModal({ isOpen: true, type, id });
    const closeDeleteModal = () => setDeleteModal({ isOpen: false, type: null, id: null });

    const openApproveModal = (type, id = null, actionType) => setApproveModal({ isOpen: true, type, id, actionType });
    const closeApproveModal = () => setApproveModal({ isOpen: false, type: null, id: null, actionType: null });

    const isPrivileged = (user) => isAdmin(user) || isOfficial(user);
    const isOwner = (authorId) => {
        if (!authorId) return false;
        const currentId = currentUser?._id || currentUser?.id;
        return currentId && String(currentId) === String(authorId);
    };

    // Admin is moderation-only in the community feed.
    // Residents and barangay officials can participate.
    const canParticipate = () => !isAdmin(currentUser);

    // Admins and Officials can moderate moderation items
    const canModerate = () => isAdmin(currentUser) || isOfficial(currentUser);

    const handleUpdate = async () => {
        const normalized = editContent.trim();
        if (!normalized || normalized === feedback.content) {
            setIsEditing(false);
            return;
        }
        if (normalized.length > MAX_FEEDBACK_LENGTH) {
            setFeedbackError(`Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.`);
            return;
        }
        try {
            setIsSubmitting(true);
            setFeedbackError('');
            await feedbacksAPI.update(feedback._id, { content: normalized });
            setIsEditing(false);
            onRefresh();
        } catch (err) {
            console.error('Failed to update feedback:', err);
            setFeedbackError(err.response?.data?.error || 'Unable to update feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        try {
            setIsSubmitting(true);
            if (deleteModal.type === 'feedback') {
                await feedbacksAPI.delete(feedback._id);
            } else if (deleteModal.type === 'reply') {
                await feedbacksAPI.deleteReply(feedback._id, deleteModal.id);
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to delete:', err);
        } finally {
            setIsSubmitting(false);
            closeDeleteModal();
        }
    };

    const submitReply = async (e) => {
        e.preventDefault();
        const normalized = replyContent.trim();
        if (!normalized) {
            setReplyError('Reply cannot be empty.');
            return;
        }
        if (normalized.length > MAX_REPLY_LENGTH) {
            setReplyError(`Reply must be ${MAX_REPLY_LENGTH} characters or fewer.`);
            return;
        }
        try {
            setIsSubmitting(true);
            setReplyError('');
            await feedbacksAPI.addReply(feedback._id, { content: normalized });
            setReplyContent('');
            setShowReplyForm(false);
            onRefresh();
        } catch (err) {
            console.error('Failed to post reply:', err);
            setReplyError(err.response?.data?.error || 'Unable to post reply. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReplyUpdate = async (replyId) => {
        const reply = feedback.replies.find(r => r._id === replyId);
        const normalized = replyEditContent.trim();
        if (!normalized || normalized === reply.content) {
            setEditingReplyId(null);
            return;
        }
        if (normalized.length > MAX_REPLY_LENGTH) {
            setReplyError(`Reply must be ${MAX_REPLY_LENGTH} characters or fewer.`);
            return;
        }
        try {
            setIsSubmitting(true);
            setReplyError('');
            await feedbacksAPI.updateReply(feedback._id, replyId, { content: normalized });
            setEditingReplyId(null);
            onRefresh();
        } catch (err) {
            console.error('Failed to update reply:', err);
            setReplyError(err.response?.data?.error || 'Unable to update reply. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmApprove = async () => {
        try {
            setIsSubmitting(true);
            if (approveModal.type === 'feedback') {
                await feedbacksAPI.approveAction(feedback._id);
            } else if (approveModal.type === 'reply') {
                await feedbacksAPI.approveReplyAction(feedback._id, approveModal.id);
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to approve:', err);
        } finally {
            setIsSubmitting(false);
            closeApproveModal();
        }
    };

    const handleReject = async (type, id = null) => {
        try {
            setIsSubmitting(true);
            if (type === 'feedback') {
                await feedbacksAPI.rejectAction(feedback._id);
            } else if (type === 'reply') {
                await feedbacksAPI.rejectReplyAction(feedback._id, id);
            }
            onRefresh();
        } catch (err) {
            console.error('Failed to reject:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRoleBadgeClass = (role) => {
        switch (role) {
            case 'administrator': return 'badge-admin';
            case 'barangay_official': return 'badge-official';
            default: return 'badge-resident';
        }
    };

    const formatRoleName = (role, position) => {
        if (role === 'barangay_official' && position) return position;
        return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    const PendingActionAlert = ({ entity, type }) => {
        const isDelete = entity.actionStatus === 'pending_delete';
        const isPendingEditLike = entity.actionStatus === 'pending_edit' || (entity.actionStatus === 'pending_approval' && entity.pendingEditContent);
        const isRejected = entity.actionStatus === 'rejected';

        const alertStyle = isDelete ? {
            borderLeftColor: '#ef4444',
            backgroundColor: '#fef2f2'
        } : {};

        const iconStyle = isDelete ? { color: '#ef4444' } : {};
        const titleStyle = isDelete ? { color: '#b91c1c' } : {};

        return (
            <div className="pending-edit-alert" style={alertStyle}>
                <div className="pending-header" style={titleStyle}>
                    <AlertCircle size={14} className="pending-icon" style={iconStyle} />
                    <span className="pending-title">
                        {isDelete ? 'Deletion Pending Admin Approval' :
                            isPendingEditLike ? 'Edit Pending Admin Approval' :
                                entity.actionStatus === 'pending_approval' ? 'Waiting for Approval' :
                                'Edit Pending Admin Approval'}
                    </span>
                    {isRejected && <span className="status-rejected">(Previously Rejected)</span>}
                </div>
                {!isDelete && isPendingEditLike && entity.pendingEditContent && (
                    <div className="pending-content-preview">
                        <strong>Proposed Change:</strong> "{entity.pendingEditContent}"
                    </div>
                )}
                {canModerate() && entity.actionStatus !== 'rejected' && (
                    <div className="pending-actions">
                        <button
                            className="btn-approve-sm"
                            onClick={() => openApproveModal(
                                type,
                                entity._id !== feedback._id ? entity._id : null,
                                isPendingEditLike ? 'pending_edit' : entity.actionStatus
                            )}
                        >
                            <CheckCircle size={14} /> Approve
                        </button>
                        <button
                            className="btn-reject-sm"
                            onClick={() => handleReject(type, entity._id !== feedback._id ? entity._id : null)}
                        >
                            <X size={14} /> Reject
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={`feedback-card ${feedback.actionStatus === 'pending_approval' ? 'is-pending' : ''}`}>
            {/* DELETE MODAL */}
            <ConfirmModal
                isOpen={deleteModal.isOpen}
                onClose={closeDeleteModal}
                onConfirm={confirmDelete}
                title="Delete Confirmation"
                message={`Are you sure you want to permanently delete this ${deleteModal.type}?`}
                isDestructive={true}
                isSubmitting={isSubmitting}
                confirmText="Delete"
            />

            {/* APPROVE ACTION MODAL */}
            <ConfirmModal
                isOpen={approveModal.isOpen}
                onClose={closeApproveModal}
                onConfirm={confirmApprove}
                title={`Verify ${approveModal.actionType === 'pending_delete' ? 'Deletion' :
                    approveModal.actionType === 'pending_approval' ? 'Post Approval' : 'Edit'}`}
                message={approveModal.actionType === 'pending_delete'
                    ? "Are you sure you want to approve this deletion? It will permanently remove the message."
                    : approveModal.actionType === 'pending_approval' ? "Are you sure you want to approve this post? It will become visible to the community."
                        : "Are you sure you want to approve this edit? It will permanently replace the original message."
                }
                isDestructive={approveModal.actionType === 'pending_delete'}
                isSubmitting={isSubmitting}
                confirmText={approveModal.actionType === 'pending_delete' ? 'Approve Deletion' :
                    approveModal.actionType === 'pending_approval' ? 'Approve Post' : 'Approve Edit'}
            />

            <div className="feedback-header">
                <div className="author-info">
                    <div className="avatar">
                        {feedback.author.profilePicture ? (
                            <img
                                src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}/uploads/${feedback.author.profilePicture}`}
                                alt="Author"
                                className="avatar-img"
                            />
                        ) : (
                            <>{feedback.author.firstName.charAt(0)}{feedback.author.lastName.charAt(0)}</>
                        )}
                    </div>
                    <div>
                        <h4 className="author-name">{feedback.author.firstName} {feedback.author.lastName}</h4>
                        <div className="meta-row">
                            <span className={`role-badge ${getRoleBadgeClass(feedback.author.role)}`}>
                                {formatRoleName(feedback.author.role, feedback.author.position)}
                            </span>
                            <span className="timestamp">
                                • {formatDistanceToNow(new Date(feedback.createdAt), { addSuffix: true })}
                            </span>
                            {feedback.actionStatus === 'pending_approval' && (
                                <span className="status-badge-pending">
                                    <AlertCircle size={10} /> Pending Approval
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Only show Edit/Delete if it's the owner AND they are allowed to participate (not an Admin/Official) */}
                {isOwner(feedback.author._id) && canParticipate() && !isEditing && (
                    <div className="action-menu">
                        <button
                            className="action-btn edit"
                            onClick={() => {
                                setEditContent(feedback.content);
                                setIsEditing(true);
                            }}
                            disabled={(feedback.actionStatus === 'pending_approval' || feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') && isOwner(feedback.author._id) && !canModerate()}
                            title={feedback.actionStatus === 'pending_approval' ? "Cannot edit during moderation (Delete and repost instead)" : (feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') && !canModerate() ? "Action pending approval" : "Edit message"}
                        >
                            <Edit2 size={16} />
                        </button>
                        <button
                            className="action-btn delete"
                            onClick={() => openDeleteModal('feedback')}
                            disabled={(feedback.actionStatus === 'pending_edit' || feedback.actionStatus === 'pending_delete') && isOwner(feedback.author._id) && !canModerate()}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {transactionId && (
                <div className="transaction-chip-row">
                    <span className="transaction-chip primary">Transaction Feedback</span>
                    <span className="transaction-chip">ID: {transactionId}</span>
                    {transactionMeta.agency && <span className="transaction-chip muted">{transactionMeta.agency}</span>}
                    {transactionMeta.programName && <span className="transaction-chip muted">{transactionMeta.programName}</span>}
                    {transactionMeta.amount !== undefined && (
                        <span className="transaction-chip muted">PHP {Number(transactionMeta.amount || 0).toLocaleString()}</span>
                    )}
                </div>
            )}

            <div className="feedback-body">
                {feedback.actionStatus && feedback.actionStatus !== 'none' && <PendingActionAlert entity={feedback} type="feedback" />}

                {isEditing ? (
                    <div className="edit-container">
                        <textarea
                            className="edit-textarea"
                            value={editContent}
                            onChange={(e) => {
                                setEditContent(e.target.value);
                                if (feedbackError) setFeedbackError('');
                            }}
                            disabled={isSubmitting}
                            maxLength={MAX_FEEDBACK_LENGTH}
                        />
                        <div className="character-count">
                            {editContent.length}/{MAX_FEEDBACK_LENGTH}
                        </div>
                        {feedbackError && <div className="error-message">{feedbackError}</div>}
                        <div className="edit-actions">
                            <button
                                className="btn-text"
                                onClick={() => { setIsEditing(false); setEditContent(feedback.content); }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary"
                                onClick={handleUpdate}
                                disabled={isSubmitting}
                            >
                                {canModerate() ? 'Save Changes' : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className={`content-text ${!expandedFeedback && feedback.content.length > FEEDBACK_PREVIEW_CHARS ? 'clamped' : ''}`}>
                            {feedback.content}
                        </p>
                        {feedback.content.length > FEEDBACK_PREVIEW_CHARS && (
                            <button
                                className="expand-btn"
                                onClick={() => setExpandedFeedback(!expandedFeedback)}
                            >
                                {expandedFeedback ? 'Show less' : 'Show more'}
                            </button>
                        )}
                    </>
                )}
            </div>

            {!isAdmin(currentUser) && feedback.actionStatus !== 'pending_approval' && (
                <div className="feedback-footer">
                    <button
                        className="reply-toggle-btn"
                        onClick={() => setShowReplyForm(!showReplyForm)}
                    >
                        <MessageCircle size={18} />
                        <span>{feedback.replies.length} {feedback.replies.length === 1 ? 'Reply' : 'Replies'}</span>
                    </button>
                </div>
            )}

            {showReplyForm && (
                <form className="reply-form" onSubmit={submitReply}>
                    <div className="reply-input-wrapper">
                        <input
                            type="text"
                            className="reply-input"
                            placeholder="Write a reply..."
                            value={replyContent}
                            onChange={(e) => {
                                setReplyContent(e.target.value);
                                if (replyError) setReplyError('');
                            }}
                            disabled={isSubmitting}
                            maxLength={MAX_REPLY_LENGTH}
                        />
                        <button
                            type="submit"
                            className="reply-submit-btn"
                            disabled={!replyContent.trim() || isSubmitting}
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="character-count subtle">
                        {replyContent.length}/{MAX_REPLY_LENGTH}
                    </div>
                    {replyError && <div className="error-message">{replyError}</div>}
                </form>
            )}

            {feedback.replies.length > 0 && (
                <div className="replies-section">
                    {feedback.replies.map(reply => (
                        <div key={reply._id} className="reply-item">
                            <div className="reply-header">
                                <span className="reply-author">
                                    {reply.author.firstName} {reply.author.lastName}
                                    {reply.author.role !== 'resident' && (
                                        <span className="reply-role"> ({formatRoleName(reply.author.role, reply.author.position)})</span>
                                    )}
                                </span>
                                <span className="timestamp">
                                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                                </span>

                                {(isOwner(reply.author._id) && canParticipate()) && (
                                    <div className="reply-actions">
                                        <button
                                            className="reply-action-btn edit"
                                            onClick={() => {
                                                setEditingReplyId(reply._id);
                                                setReplyEditContent(reply.content);
                                            }}
                                            disabled={(reply.actionStatus === 'pending_edit' || reply.actionStatus === 'pending_delete') && isOwner(reply.author._id) && !canModerate()}
                                            title="Edit reply"
                                        >
                                            <Edit2 size={14} />
                                        </button>
                                        <button
                                            className="reply-action-btn delete"
                                            onClick={() => openDeleteModal('reply', reply._id)}
                                            disabled={(reply.actionStatus === 'pending_edit' || reply.actionStatus === 'pending_delete') && isOwner(reply.author._id) && !canModerate()}
                                            title="Delete reply"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {reply.actionStatus && reply.actionStatus !== 'none' && <PendingActionAlert entity={reply} type="reply" />}

                            {editingReplyId === reply._id ? (
                                <div className="edit-container mt-2">
                                    <textarea
                                        className="edit-textarea reply-edit"
                                        value={replyEditContent}
                                        onChange={(e) => {
                                            setReplyEditContent(e.target.value);
                                            if (replyError) setReplyError('');
                                        }}
                                        disabled={isSubmitting}
                                        rows={2}
                                        maxLength={MAX_REPLY_LENGTH}
                                    />
                                    <div className="character-count subtle">
                                        {replyEditContent.length}/{MAX_REPLY_LENGTH}
                                    </div>
                                    {replyError && <div className="error-message">{replyError}</div>}
                                    <div className="edit-actions">
                                        <button
                                            className="btn-text-sm"
                                            onClick={() => { setEditingReplyId(null); setReplyEditContent(reply.content); }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="btn-primary-sm"
                                            onClick={() => handleReplyUpdate(reply._id)}
                                            disabled={isSubmitting}
                                        >
                                            {canModerate() ? 'Save' : 'Submit for Approval'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className={`reply-content ${!expandedReplies[reply._id] && reply.content.length > REPLY_PREVIEW_CHARS ? 'clamped' : ''}`}>
                                        {reply.content}
                                    </p>
                                    {reply.content.length > REPLY_PREVIEW_CHARS && (
                                        <button
                                            className="expand-btn small"
                                            onClick={() => setExpandedReplies((prev) => ({ ...prev, [reply._id]: !prev[reply._id] }))}
                                        >
                                            {expandedReplies[reply._id] ? 'Show less' : 'Show more'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default FeedbackCard;
