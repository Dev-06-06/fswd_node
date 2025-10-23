import React, { useState } from 'react';
import './SellModal.css'; // We can reuse the same modal styles

function InvestFdModal({ fd, onClose, onConfirm }) {
  const [amount, setAmount] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      instrument: fd.bank_name,
      quantity: parseFloat(amount),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Invest in {fd.bank_name}</h3>
        <p>Interest Rate: <strong>{fd.rate}</strong> for {fd.tenor}</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Investment Amount (INR)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 50000"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="confirm-button" style={{backgroundColor: '#27ae60'}}>Confirm Investment</button>
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InvestFdModal;