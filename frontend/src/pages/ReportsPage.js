import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ReportsPage.css'; // We'll create this file for styling

function ReportsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/api/reports/transactions');
        setTransactions(response.data);
      } catch (err) {
        setError('Failed to fetch transaction data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (loading) {
    return <div>Loading reports...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const formatCurrency = (value) => {
    return value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="reports-container">
      <h2>Transaction History</h2>
      <table className="reports-table">
        <thead>
          
          <tr>
            <th>Date & time</th>
            <th>Type</th>
            <th>Instrument</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Total Value</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx, index) => (
            <tr key={index}>
              <td>{tx.date}</td>
              <td>
                <span className={`tx-type ${tx.type.toLowerCase()}`}>{tx.type}</span>
              </td>
              <td>{tx.instrument}</td>
              <td>{tx.quantity}</td>
              <td>{formatCurrency(tx.price)}</td>
              <td>{formatCurrency(tx.quantity * tx.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReportsPage;