import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import SellModal from '../components/SellModal';
import Spinner from '../components/Spinner'; // --- 1. IMPORT SPINNER ---
import { toast } from 'react-toastify';
import './HoldingsPage.css';

function HoldingsPage() {
  const { user } = useContext(AuthContext);
  const [holdings, setHoldings] = useState([]);
  const [fdRates, setFdRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [sellingHolding, setSellingHolding] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({ symbol: '', quantity: '', purchase_price: '' });

  const fetchData = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const [holdingsResponse, fdRatesResponse] = await Promise.all([
        axios.get(`http://127.0.0.1:5000/api/holdings?username=${user.username}`),
        axios.get('http://127.0.0.1:5000/api/fd-rates')
      ]);
      setHoldings(holdingsResponse.data);
      setFdRates(fdRatesResponse.data);
    } catch (err) {
      setError('Failed to fetch page data.');
      toast.error('Failed to fetch page data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleInputChange = (e) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleAddHolding = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://127.0.0.1:5000/api/holdings', { ...formState, username: user.username });
      toast.success('Stock added successfully!');
      setShowForm(false);
      setFormState({ symbol: '', quantity: '', purchase_price: '' });
      fetchData();
    } catch (err) {
      toast.error('Failed to add stock.');
    }
  };

  const handleConfirmSell = async (sellData) => {
    try {
      await axios.post('http://127.0.0.1:5000/api/holdings/sell', { ...sellData, username: user.username });
      toast.success('Sale recorded successfully!');
      setSellingHolding(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sale.');
    }
  };

  if (error && holdings.length === 0) return <div className="error-container">{error}</div>;

  const formatCurrency = (value) => {
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  };

  return (
    <div className="holdings-container">
      {sellingHolding && <SellModal holding={sellingHolding} onClose={() => setSellingHolding(null)} onConfirm={handleConfirmSell} />}
      
      <div className="holdings-header">
        <h2>{user && user.full_name ? `${user.full_name}'s Holdings` : 'Your Holdings'}</h2>
        <button onClick={() => setShowForm(!showForm)} className="add-button">{showForm ? 'Cancel' : '+ Add Stock'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleAddHolding} className="add-holding-form">
          <h3>Add New Stock Holding</h3>
          <input name="symbol" value={formState.symbol} onChange={handleInputChange} placeholder="Stock Symbol (e.g., RELIANCE.NS)" required />
          <input name="quantity" type="number" value={formState.quantity} onChange={handleInputChange} placeholder="Quantity" required />
          <input name="purchase_price" type="number" step="0.01" value={formState.purchase_price} onChange={handleInputChange} placeholder="Average Purchase Price" required />
          <button type="submit">Save Holding</button>
        </form>
      )}

      {/* --- 2. USE THE SPINNER --- */}
      {loading ? ( <Spinner /> ) : (
        <>
          <table className="holdings-table">
            <thead>
              <tr>
                <th>Instrument</th><th>Quantity</th><th>Avg. Cost</th><th>Current Price</th><th>Total Value</th><th>P/L</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdings.length > 0 ? (
                holdings.map((h, i) => (
                  <tr key={`h-${i}`}>
                    <td>{h.instrument}</td><td>{h.quantity.toLocaleString('en-IN')}</td><td>{formatCurrency(h.avg_cost)}</td><td>{formatCurrency(h.current_price)}</td><td>{formatCurrency(h.total_value)}</td><td className={h.pnl >= 0 ? 'profit' : 'loss'}>{formatCurrency(h.pnl)}</td>
                    <td>{h.type === 'Equity' && <button onClick={() => setSellingHolding(h)} className="sell-button">Sell</button>}</td>
                  </tr>
                ))
              ) : ( <tr><td colSpan="7" style={{ textAlign: 'center' }}>You have no holdings yet. Add your first stock!</td></tr> )}
            </tbody>
          </table>

          <div className="fd-rates-section">
            <h3>Top Bank FD Rates (1 Year)</h3>
            <table className="holdings-table fd-table">
              <thead><tr><th>Bank Name</th><th>Interest Rate</th><th>Action</th></tr></thead>
              <tbody>
                {fdRates.map((fd, i) => (
                  <tr key={`fd-${i}`}><td>{fd.bank_name}</td><td>{fd.rate}</td><td><button className="invest-button">Invest Now</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default HoldingsPage;

