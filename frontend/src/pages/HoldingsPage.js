import React, { useState, useEffect, useContext, useCallback, useRef } from 'react'; // 1. Import useRef
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import SellModal from '../components/SellModal';
import InvestFdModal from '../components/InvestFdModal';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import './HoldingsPage.css';

// --- 2. This is our new custom hook ---
// It holds the "previous" state of your holdings
function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
// --- End of new hook ---


// --- StockSearch Component ---
const StockSearch = ({ onStockSelect }) => {
  // ... (this component remains unchanged) ...
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  const fetchStocks = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/search?q=${searchQuery}`);
      setResults(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedFetch = useCallback(debounce(fetchStocks, 300), []);

  const handleChange = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    debouncedFetch(newQuery);
  };

  const handleSelect = (stock) => {
    onStockSelect(stock.symbol, stock.description);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="search-container">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder="Search for a stock (e.g., Reliance)"
        className="search-input"
      />
      {isLoading && <Spinner />}
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((stock) => (
            <li key={stock.symbol} onClick={() => handleSelect(stock)}>
              <strong>{stock.symbol}</strong> ({stock.description})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
// --- End of StockSearch Component ---


function HoldingsPage() {
  const { user } = useContext(AuthContext);
  const [holdings, setHoldings] = useState([]);
  const [fdRates, setFdRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- 3. We call our new hook ---
  const prevHoldings = usePrevious(holdings);

  const [sellingHolding, setSellingHolding] = useState(null);
  const [showForm, setShowForm] = useState(false);
  
  const [formState, setFormState] = useState({
    symbol: '',
    quantity: '',
    purchase_price: '',
  });
  const [stockDescription, setStockDescription] = useState('');
  
  const [searchPrice, setSearchPrice] = useState(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);
  const [investingFd, setInvestingFd] = useState(null);

  const fetchData = useCallback(async () => {
    if (!user) { 
      setLoading(false); 
      return; 
    }
    setError('');
    try {
      const [holdingsResponse, fdRatesResponse] = await Promise.all([
        axios.get(`/api/holdings?username=${user.username}`),
        axios.get('/api/data/fd-rates') 
      ]);
      
      // We now set the new holdings, which will trigger
      // the `prevHoldings` hook to update *next* render
      setHoldings(holdingsResponse.data);
      setFdRates(fdRatesResponse.data);

    } catch (err) {
      setError('Failed to fetch page data.');
      if(loading) {
        toast.error('Failed to fetch page data.');
      }
    } finally {
      if(loading) {
        setLoading(false);
      }
    }
  }, [user, loading]); // This logic is unchanged


  useEffect(() => {
    fetchData(); // Call once immediately on load
    
    const intervalId = setInterval(() => {
      console.log("Polling for new prices...");
      fetchData();
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [fetchData]);


  // ... (All handler functions remain the same) ...
  const handleInputChange = (e) => {
    setFormState({ ...formState, [e.target.name]: e.target.value });
  };

  const handleAddHolding = async (e) => {
    e.preventDefault();
    if (!formState.symbol) {
      toast.error('Please select a stock from the search.');
      return;
    }
    try {
      await axios.post('/api/holdings', {
        ...formState,
        username: user.username,
      });
      toast.success('Stock added successfully!');
      setShowForm(false);
      setFormState({ symbol: '', quantity: '', purchase_price: '' });
      setStockDescription('');
      setSearchPrice(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to add stock.');
    }
  };

  const handleStockSelect = async (symbol, description) => {
    setFormState(prev => ({ ...prev, symbol: symbol }));
    setStockDescription(description);
    setSearchPrice(null);
    setIsPriceLoading(true);
    
    try {
      const response = await axios.get(
        `/api/broker/get-single-quote?symbol=${symbol}&username=${user.username}`
      );
      setSearchPrice(response.data.price);
    } catch (err) {
      toast.error('Could not fetch live price.');
    } finally {
      setIsPriceLoading(false);
    }
  };

  const handleConfirmSell = async (sellData) => {
    try {
      await axios.post('/api/holdings/sell', { ...sellData, username: user.username });
      toast.success('Sale recorded successfully!');
      setSellingHolding(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record sale.');
    }
  };
  
  const handleConfirmInvestFd = async (investData) => {
    try {
      await axios.post('/api/holdings/add-fd', {
        ...investData,
        username: user.username
      });
      toast.success('FD investment recorded successfully!');
      setInvestingFd(null);
      fetchData();
    } catch (err) {
      toast.error('Failed to record FD investment.');
    }
  };

  if (error && holdings.length === 0)
    return <div className="error-container">{error}</div>;

  const formatCurrency = (value) => {
    if (typeof value !== 'number') {
      value = 0;
    }
    return value.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    });
  };

  return (
    <div className="holdings-container">
      {sellingHolding && <SellModal holding={sellingHolding} onClose={() => setSellingHolding(null)} onConfirm={handleConfirmSell} />}
      {investingFd && <InvestFdModal fd={investingFd} onClose={() => setInvestingFd(null)} onConfirm={handleConfirmInvestFd} />}
      
      <div className="holdings-header">
        <h2>Your Holdings</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? 'Cancel' : '+ Add Stock'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddHolding} className="add-holding-form">
          <h3>Add New Stock Holding</h3>
          
          <label>1. Search for a stock</label>
          <StockSearch onStockSelect={handleStockSelect} />
          
          {formState.symbol && (
            <div className="selected-stock-display">
              Selected: <strong>{stockDescription}</strong> ({formState.symbol})
              <div className="live-price-display">
                {isPriceLoading ? (
                  <Spinner />
                ) : searchPrice !== null ? (
                  <>
                    Live Price: <strong>{formatCurrency(searchPrice)}</strong>
                  </>
                ) : null}
              </div>
            </div>
          )}

          <label>2. Enter your purchase details</label>
          <input
            name="quantity"
            type="number"
            value={formState.quantity}
            onChange={handleInputChange}
            placeholder="Quantity"
            required
            disabled={!formState.symbol}
          />
          <input
            name="purchase_price"
            type="number"
            step="0.01"
            value={formState.purchase_price}
            onChange={handleInputChange}
            placeholder="Your Average Purchase Price"
            required
            disabled={!formState.symbol}
          />
          <button type="submit" className="btn-primary" disabled={!formState.symbol || isPriceLoading}>Save Holding</button>
        </form>
      )}

       {loading ? ( <Spinner /> ) : (
        <>
          <div className="widget-container">
            <h3 className="widget-title">Your Investments</h3>
            <table className="main-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Quantity</th>
                  <th>Avg. Cost</th>
                  <th>Current Price</th>
                  <th>Total Value</th>
                  <th>P/L</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holdings.length > 0 ? (
                  holdings.map((h) => {
                    // --- 4. THIS IS THE UPDATED LOGIC ---
                    const prevHolding = prevHoldings?.find(ph => ph.symbol === h.symbol);
                    let changeStatus = 'none';
                    
                    // FIX: We now compare the current_price, not just P/L
                    if (prevHolding && h.current_price > prevHolding.current_price) {
                      changeStatus = 'up';
                    } else if (prevHolding && h.current_price < prevHolding.current_price) {
                      changeStatus = 'down';
                    }
                    // --- END OF UPDATED LOGIC ---

                    return (
                      // 5. Apply the changeStatus (e.g., 'up' or 'down') as a class
                      <tr key={h.symbol} className={`holding-row ${changeStatus}`}>
                        <td>{h.instrument}</td>
                        <td>{h.quantity.toLocaleString('en-IN')}</td>
                        <td>{formatCurrency(h.avg_cost)}</td>
                        <td className="current-price">{formatCurrency(h.current_price)}</td>
                        <td className="total-value">{formatCurrency(h.total_value)}</td>
                        <td className={h.pnl >= 0 ? 'profit' : 'loss'}>
                          {formatCurrency(h.pnl)}
                        </td>
                        <td>
                          {h.type === 'Equity' && (
                            <button onClick={() => setSellingHolding(h)} className="btn-secondary">
                              Sell
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : ( <tr><td colSpan="7" style={{ textAlign: 'center' }}>You have no holdings yet. Add your first stock!</td></tr> )}
              </tbody>
            </table>
          </div>

          <div className="widget-container">
            <h3 className="widget-title">Top Bank FD Rates (1 Year)</h3>
            <table className="main-table fd-table">
              <thead>
                <tr>
                  <th>Bank Name</th>
                  <th>Interest Rate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {fdRates.map((fd, i) => (
                  <tr key={`fd-${i}`}>
                    <td>{fd.bank_name}</td>
                    <td>{fd.rate}</td>
                    <td>
                      <button onClick={() => setInvestingFd(fd)} className="btn-primary-outline">
                        Invest Now
                      </button>
                    </td>
                  </tr>
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