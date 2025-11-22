import React from 'react';
import './ConfirmationModal.css';

/**
 * A reusable confirmation modal.
 * * @param {object} props
 * @param {boolean} props.show - Whether the modal is visible
 * @param {string} props.title - The modal title (e.g., "Confirm Deletion")
 * @param {string} props.message - The confirmation message
 * @param {function} props.onConfirm - Function to call when "Confirm" is clicked
 * @param {function} props.onCancel - Function to call when "Cancel" is clicked
 * @param {boolean} props.isConfirming - Disables the confirm button (e.g., during API call)
 */
const ConfirmationModal = ({ show, title, message, onConfirm, onCancel, isConfirming = false }) => {
  if (!show) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button 
            className="btn-cancel" 
            onClick={onCancel} 
            disabled={isConfirming}
          >
            Cancel
          </button>
          <button 
            className="btn-confirm-delete" 
            onClick={onConfirm} 
            disabled={isConfirming}
          >
            {isConfirming ? 'Deleting...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;