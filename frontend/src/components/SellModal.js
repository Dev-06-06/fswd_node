import React, { useState } from 'react';
import './SellModal.css'; // We'll create this file for styling

function SellModal({ holding, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({
      symbol: holding.symbol,
      quantity: parseFloat(quantity),
      price: parseFloat(price),
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Sell {holding.instrument}</h3>
        <p>You currently own: {holding.quantity.toLocaleString('en-IN')}</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Quantity to Sell</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              max={holding.quantity}
              placeholder="e.g., 10"
              required
            />
          </div>
          <div className="input-group">
            <label>Sale Price per Share</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={`Current Price: ${holding.current_price.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="confirm-button">Confirm Sale</button>
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default SellModal;