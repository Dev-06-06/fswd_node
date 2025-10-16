import React from 'react';
import './InfoModal.css'; // We'll create this for styling

function InfoModal({ title, message, onClose }) {
  return (
    <div className="info-modal-overlay">
      <div className="info-modal-content">
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="info-modal-actions">
          <button onClick={onClose} className="close-button">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default InfoModal;
