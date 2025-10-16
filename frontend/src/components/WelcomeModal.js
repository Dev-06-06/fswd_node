import React, { useState } from 'react';
import './SellModal.css'; // We can reuse the modal styles for consistency

function WelcomeModal({ onConfirm }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Welcome to MyPortfolio!</h3>
        <p>Let's get your profile set up. What is your full name?</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Arjun Kumar"
              required
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="confirm-button" style={{backgroundColor: '#27ae60', borderColor: '#27ae60'}}>Save Name</button>
          </div>
        </form>
      </div>
    </div>
  );
}
export default WelcomeModal;
