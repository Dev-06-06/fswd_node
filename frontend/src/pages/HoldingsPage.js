import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HoldingsPage.css';

function HoldingsPage() {
  const [holdings, setHoldings] = useState([]);
  const [fdRates, setFdRates] = useState([]); // New state for FD rates
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use Promise.all to fetch from both endpoints concurrently
        const [holdingsResponse, fdRatesResponse] = await Promise.all([
          axios.get('http://127.0.0.1:5000/api/holdings'),
          axios.get('http://127.0.0.1:5000/api/fd-rates')
        ]);
        setHoldings(holdingsResponse.data);
        setFdRates(fdRatesResponse.data);
      } catch (err) {
        setError('Failed to fetch page data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading holdings...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  const formatCurrency = (value) => {
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  };

  return (
    <div className="holdings-container">
      <h2>Your Holdings</h2>
      <table className="holdings-table">
        <thead>
          <tr>
            <th>Instrument</th>
            <th>Quantity</th>
            <th>Avg. Cost</th>
            <th>Current Price</th>
            <th>Total Value</th>
            <th>Profit/Loss (P/L)</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding, index) => (
            <tr key={`holding-${index}`}>
              <td>{holding.instrument}</td>
              <td>{holding.quantity.toLocaleString('en-IN')}</td>
              <td>{formatCurrency(holding.avg_cost)}</td>
              <td>{formatCurrency(holding.current_price)}</td>
              <td>{formatCurrency(holding.total_value)}</td>
              <td className={holding.pnl >= 0 ? 'profit' : 'loss'}>
                {formatCurrency(holding.pnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- NEW FD RATES SECTION --- */}
      <div className="fd-rates-section">
        <h3>Top Bank FD Rates (1 Year)</h3>
        <table className="holdings-table fd-table">
          <thead>
            <tr>
              <th>Bank Name</th>
              <th>Interest Rate</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {fdRates.map((fd, index) => (
              <tr key={`fd-${index}`}>
                <td>{fd.bank_name}</td>
                <td>{fd.rate}</td>
                <td><button className="invest-button">Invest Now</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default HoldingsPage;