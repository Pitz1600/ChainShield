import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import '../../styles/ConfirmModal.css';
import useLockBodyScroll from '../../utils/useLockBodyScroll';

function ConfirmModal({ isOpen, onClose, onConfirm, title, message, isSubmitting = false, isDestructive = false, confirmText = "Confirm" }) {
    if (!isOpen) return null;

    useLockBodyScroll(isOpen);

    return createPortal(
        <div className="confirm-modal-overlay">
            <div className="confirm-modal">
                <div className="confirm-header">
                    <div className="confirm-title-group">
                        {isDestructive ? (
                            <AlertTriangle className="confirm-icon destructive" size={24} />
                        ) : (
                            <CheckCircle className="confirm-icon success" size={24} />
                        )}
                        <h3>{title}</h3>
                    </div>
                    <button className="confirm-close-btn" onClick={onClose} disabled={isSubmitting}>
                        <X size={20} />
                    </button>
                </div>

                <div className="confirm-body">
                    <p>{message}</p>
                </div>

                <div className="confirm-footer">
                    <button type="button" className="btn-cancel" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className={`btn-confirm ${isDestructive ? 'destructive' : 'success'}`}
                        onClick={onConfirm}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Processing...' : confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export default ConfirmModal;
