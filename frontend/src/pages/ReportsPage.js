import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import './ReportsPage.css';

// --- Custom Hook for Animating Numbers ---
const useCountUp = (end, duration = 1500) => {
  const [count, setCount] = useState(300); // Start from 300
  const frameRate = 60; // 60fps
  const totalFrames = duration / (1000 / frameRate);
  const start = 300; // Investor score starts at 300
  
  useEffect(() => {
    let frame = 0;
    const counter = setInterval(() => {
      frame++;
      const progress = Math.min(1, frame / totalFrames); // Easing function (easeOut)
      const current = Math.round(start + (end - start) * (1 - Math.pow(1 - progress, 3)));

      if (frame >= totalFrames) { // Use >= for safety
        setCount(end); // Ensure it lands on the exact end value
        clearInterval(counter);
      } else {
        setCount(current);
      }
    }, (1000 / frameRate));

    return () => clearInterval(counter);
  }, [end, duration, totalFrames]);

  return count;
};

// --- Main Reports Page Component ---
function ReportsPage() {
  const { user } = useContext(AuthContext);
  const [activeView, setActiveView] = useState('history'); // 'history', 'pnl', 'realReturn', 'cibil'
  const [transactions, setTransactions] = useState([]);
  const [pnlData, setPnlData] = useState([]);
  const [realReturnData, setRealReturnData] = useState([]);
  const [cibilData, setCibilData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all report data concurrently using relative URLs
        const [txResponse, pnlResponse, rrResponse, cibilResponse] = await Promise.all([
          axios.get(`/api/reports/transactions?username=${user.username}`),
          axios.get(`/api/reports/pnl?username=${user.username}`),
          axios.get(`/api/reports/real-returns?username=${user.username}`),
          axios.get(`/api/reports/cibil-score?username=${user.username}`)
        ]);

        setTransactions(txResponse.data);
        setPnlData(pnlResponse.data);
        setRealReturnData(rrResponse.data);
        setCibilData(cibilResponse.data);
      } catch (err) {
        setError('Failed to fetch some report data.');
        toast.error('Failed to fetch some report data.');
        console.error("Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <Spinner />;

  const formatCurrency = (value) => {
     if (typeof value !== 'number' || isNaN(value)) {
        return 'N/A';
     }
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Reports</h2>
        <div className="view-toggle">
          <button onClick={() => setActiveView('history')} className={activeView === 'history' ? 'active' : ''}>Transactions</button>
          <button onClick={() => setActiveView('pnl')} className={activeView === 'pnl' ? 'active' : ''}>P&L</button>
          <button onClick={() => setActiveView('realReturn')} className={activeView === 'realReturn' ? 'active' : ''}>Real Return</button>
          <button onClick={() => setActiveView('cibil')} className={activeView === 'cibil' ? 'active' : ''}>Investor Score</button>
        </div>
      </div>

      {activeView === 'history' && <TransactionHistory transactions={transactions} formatCurrency={formatCurrency} />}
      {activeView === 'pnl' && <PnlStatement pnlData={pnlData} formatCurrency={formatCurrency} />}
      {activeView === 'realReturn' && <RealReturnStatement realReturnData={realReturnData} formatCurrency={formatCurrency} />}
      
      {/* This now correctly waits for cibilData before rendering */}
      {activeView === 'cibil' && (cibilData ? <InvestorScoreView cibilData={cibilData} /> : <div className="report-widget">Loading Investor Score...</div>)}

      {error && activeView !== 'cibil' && <div className="error" style={{marginTop: '20px'}}>{error}</div>}
    </div>
  );
}

// --- Sub-component: Transaction History Table ---
const TransactionHistory = ({ transactions, formatCurrency }) => (
  <div className="report-widget">
    <h3 className="widget-title">Transaction History</h3>
    <table className="reports-table">
      <thead>
        <tr><th>Date & Time</th><th>Type</th><th>Instrument</th><th>Quantity</th><th>Price</th><th>Total Value</th></tr>
      </thead>
      <tbody>
        {transactions && transactions.length > 0 ? (
          transactions.map((tx, index) => (
            <tr key={`tx-${index}`}>
              {/* Use toLocaleString for a cleaner date/time format */}
              <td>{new Date(tx.date).toLocaleString()}</td>
              <td><span className={`tx-type ${tx.type?.toLowerCase()}`}>{tx.type}</span></td>
              <td>{tx.instrument}</td>
              <td>{tx.quantity}</td>
              <td>{formatCurrency(tx.price)}</td>
              <td>{formatCurrency(tx.quantity * tx.price)}</td>
            </tr>
          ))
        ) : ( <tr><td colSpan="6" style={{ textAlign: 'center' }}>No transactions found.</td></tr> )}
      </tbody>
    </table>
  </div>
);

// --- Sub-component: P&L Statement Table ---
const PnlStatement = ({ pnlData, formatCurrency }) => (
  <div className="report-widget">
    <h3 className="widget-title">Realized Profit & Loss</h3>
    <table className="reports-table">
      <thead>
        <tr><th>Instrument</th><th>Total Sale Value</th><th>Cost Basis</th><th>Realized P&L</th></tr>
      </thead>
      <tbody>
        {pnlData && pnlData.length > 0 ? (
          pnlData.map((pnl, index) => (
            <tr key={`pnl-${index}`}>
              <td>{pnl.instrument}</td>
              <td>{formatCurrency(pnl.total_sale_value)}</td>
              <td>{formatCurrency(pnl.cost_basis)}</td>
              <td className={pnl.realized_pnl >= 0 ? 'profit' : 'loss'}>{formatCurrency(pnl.realized_pnl)}</td>
            </tr>
          ))
        ) : ( <tr><td colSpan="4" style={{ textAlign: 'center' }}>No realized P&L data. Sell assets to see data here.</td></tr> )}
      </tbody>
    </table>
  </div>
);

// --- Sub-component: Real Return Statement Table ---
const RealReturnStatement = ({ realReturnData, formatCurrency }) => (
  <div className="report-widget">
    <h3 className="widget-title">Inflation-Adjusted Real Return</h3>
    <p className="inflation-note">Calculated using an assumed annual inflation rate of 6.0%</p>
    <table className="reports-table">
      <thead>
        <tr><th>Instrument</th><th>Nominal P&L</th><th>Inflation Adjustment</th><th>Real P&L</th></tr>
      </thead>
      <tbody>
        {realReturnData && realReturnData.length > 0 ? (
          realReturnData.map((rr, index) => (
            <tr key={`rr-${index}`}>
              <td>{rr.instrument}</td>
              <td>{formatCurrency(rr.nominal_pnl)}</td>
              {/* Inflation adjustment is always a "loss" or reduction */}
              <td className="loss">{formatCurrency(rr.inflation_adjustment)}</td>
              <td className={rr.real_pnl >= 0 ? 'profit' : 'loss'}>{formatCurrency(rr.real_pnl)}</td>
            </tr>
          ))
        ) : ( <tr><td colSpan="4" style={{ textAlign: 'center' }}>No Real Return data. Sell assets to see data here.</td></tr> )}
      </tbody>
    </table>
  </div>
);


// --- Helper: Color Function ---
const getFeedbackColor = (label) => {
  switch (label) {
    case "Excellent": return 'var(--profit-color)';
    case "Good": return 'var(--growth-color)'; /* WAS: --warning-color-dark */
    case "Average": return 'var(--growth-color)'; /* WAS: --warning-color */
    case "Needs Improvement": return 'var(--neutral-color)'; /* WAS: --loss-color */
    case "Just Started!": return 'var(--neutral-color)';
    case "Building Habits": return 'var(--neutral-color)';
    case "Getting Consistent": return 'var(--growth-color)'; /* WAS: --warning-color */
    case "Long-Term Focused": return 'var(--profit-color)';
    case "Veteran Investor!": return 'var(--profit-color)';
    default: return '#555';
  }
};

// --- Sub-component: Progress Bar ---
const FactorProgressBar = ({ title, value, max, label, color, icon }) => {
  const [fillWidth, setFillWidth] = useState(0);

  // Animate the bar fill on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setFillWidth((value / max) * 100);
    }, 100); // 100ms delay to trigger CSS transition
    return () => clearTimeout(timer);
  }, [value, max]);

  return (
    <div className="factor-bar-container">
      <div className="factor-bar-label">
        <span>
          {/* Icon */}
          {icon}
          {title}
        </span>
        <strong style={{ color: color }}>{label}</strong>
      </div>
      <div className="factor-bar">
        <div 
          className="factor-bar-fill" 
          style={{ width: `${fillWidth}%`, backgroundColor: color }}
        ></div>
      </div>
      <div className="factor-points">{value} / {max} pts</div>
    </div>
  );
};

// --- Sub-component: Investor Score View ---
const InvestorScoreView = ({ cibilData }) => {
    // This is the FIX: We no longer have a conditional return here.
    // We can safely call hooks because the parent component (ReportsPage)
    // already checked if cibilData exists.
    
    const { score, feedback, breakdown } = cibilData;
    
    const animatedScore = useCountUp(score, 1500); // 1.5 second animation
    const [gaugeFill, setGaugeFill] = useState(0); // 0% fill
    
    const scorePercentage = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));

    // Animate Gauge
    useEffect(() => {
      const timer = setTimeout(() => {
        setGaugeFill(scorePercentage * 1.8); // 1.8 degrees per percentage point
      }, 100);
      return () => clearTimeout(timer);
    }, [scorePercentage]);

    // --- Tips Logic ---
    const improvementTips = [];
    if (feedback?.Diversification === "Needs Improvement") improvementTips.push("Diversify your portfolio by investing in different stocks or asset classes (like bonds or FDs).");
    if (feedback?.Profitability === "Average" || feedback?.Profitability === "Needs Improvement") improvementTips.push("Review past trades to refine your investment strategy for better profitability.");
    if (feedback?.Discipline === "Just Started!" || feedback?.Discipline === "Building Habits") improvementTips.push("Focus on long-term investing; holding investments for longer periods often leads to better results.");

    // --- Score Color Logic ---
    const getScoreColor = (s) => {
      if (s > 750) return 'var(--profit-color)'; // Excellent = Green
      if (s > 600) return 'var(--growth-color)'; // Growing = Teal
      return 'var(--neutral-color)'; // Building = Blue
    };
    const scoreColor = getScoreColor(score);

    return (
        <div className="report-widget investor-score-view">
          <h3 className="widget-title">Your Investor Score</h3>
          
          <div className="investor-score-grid">
            
            {/* --- GAUGE (Column 1) --- */}
            <div className="investor-gauge-wrapper">
              <div className="cibil-gauge-container">
                  <div className="cibil-gauge">
                      {/* --- THIS IS THE FIX --- */}
                      {/* Removed the 'backgroundColor' style to allow the CSS gradient to show */}
                      <div className="cibil-gauge-fill" style={{ transform: `rotate(${gaugeFill}deg)` }}></div>
                      {/* --- END OF FIX --- */}
                      
                      <div className="cibil-gauge-cover">
                          <div className="cibil-score-value" style={{ color: scoreColor }}>{animatedScore}</div>
                          <div className="cibil-score-label">out of 900</div>
                      </div>
                  </div>
              </div>
            </div>

            {/* --- BREAKDOWN (Column 2) --- */}
            <div className="investor-breakdown-wrapper">
              {/* Base Score (No bar, just text) */}
              <div className="factor-bar-label" style={{borderBottom: '1px dashed #eee', paddingBottom: '10px', marginBottom: '10px'}}>
                <span>
                  <svg className="factor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20V14H14V20H19V12H22L12 3L2 12H5V20H10Z"/></svg>
                  Base Score
                </span>
                <strong style={{ color: '#555' }}>+300 pts</strong>
              </div>

              {/* Progress Bars */}
              <FactorProgressBar 
                title="Diversification"
                value={breakdown.Diversification}
                max={200}
                label={feedback.Diversification}
                color={getFeedbackColor(feedback.Diversification)}
                icon={<svg className="factor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3ZM3 19V5H11V19H3ZM21 19H13V11H21V19ZM21 9H13V5H21V9Z"/></svg>}
              />
              <FactorProgressBar 
                title="Profitability"
                value={breakdown.Profitability}
                max={200}
                label={feedback.Profitability}
                color={getFeedbackColor(feedback.Profitability)}
                icon={<svg className="factor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20ZM15.59 10.59L12 14.17L9.41 11.59L8 13L12 17L17 12L15.59 10.59Z"/></svg>}
              />
              <FactorProgressBar 
                title="Discipline"
                value={breakdown.Discipline}
                max={200}
                label={feedback.Discipline}
                color={getFeedbackColor(feedback.Discipline)}
                icon={<svg className="factor-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20ZM11 7H13V12L17.5 14.5L16.25 15.75L11 13V7Z"/></svg>}
              />
            </div>
          </div>
          
          {/* --- Improvement Tips (Full Width Below Grid) --- */}
          {improvementTips.length > 0 && (
              <div className="cibil-tips improved-tips">
                  <h4>How to Improve Your Score:</h4>
                  <ul>{improvementTips.map((tip, index) => <li key={index}>{tip}</li>)}</ul>
              </div>
          )}
          {improvementTips.length === 0 && score > 300 && (
              <div className="cibil-tips improved-tips excellent-performance">
                  <h4>Excellent Performance!</h4>
                  <p>Your investment habits are strong across the board. Keep up the great work!</p>
              </div>
          )}
        </div>
    );
};


export default ReportsPage;