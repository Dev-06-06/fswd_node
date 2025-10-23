import React, { useState, useEffect, useContext } from 'react'; // Corrected this line
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import './ReportsPage.css';

function ReportsPage() {
  const { user } = useContext(AuthContext);
  const [activeView, setActiveView] = useState('history'); // 'history', 'pnl', 'realReturn', 'cibil'
  const [transactions, setTransactions] = useState([]);
  const [pnlData, setPnlData] = useState([]);
  const [realReturnData, setRealReturnData] = useState([]); // State for real return data
  const [cibilData, setCibilData] = useState(null); // State for CIBIL score data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all report data concurrently
        const [txResponse, pnlResponse, rrResponse, cibilResponse] = await Promise.all([
          axios.get(`http://127.0.0.1:5000/api/reports/transactions?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/pnl?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/real-returns?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/cibil-score?username=${user.username}`)
        ]);
        setTransactions(txResponse.data);
        setPnlData(pnlResponse.data);
        setRealReturnData(rrResponse.data);
        setCibilData(cibilResponse.data);
      } catch (err) {
        setError('Failed to fetch some report data.');
        toast.error('Failed to fetch some report data.');
        console.error("Fetch Error:", err); // Log the specific error
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) return <Spinner />;
  // Don't show global error if some data loaded, let individual components handle it
  // if (error) return <div className="error">{error}</div>;

  const formatCurrency = (value) => {
    // Check if value is a valid number before formatting
     if (typeof value !== 'number' || isNaN(value)) {
        return 'N/A'; // Or some other placeholder
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
          <button onClick={() => setActiveView('cibil')} className={activeView === 'cibil' ? 'active' : ''}>CIBIL Score</button>
        </div>
      </div>

      {/* Render the active view based on state */}
      {activeView === 'history' && <TransactionHistory transactions={transactions} formatCurrency={formatCurrency} />}
      {activeView === 'pnl' && <PnlStatement pnlData={pnlData} formatCurrency={formatCurrency} />}
      {activeView === 'realReturn' && <RealReturnStatement realReturnData={realReturnData} formatCurrency={formatCurrency} />}
      {activeView === 'cibil' && (cibilData ? <CibilScoreView cibilData={cibilData} /> : <div>Loading CIBIL score...</div>)}
      {error && <div className="error" style={{marginTop: '20px'}}>{error}</div>}
    </div>
  );
}

// --- Sub-component for Transaction History Table ---
const TransactionHistory = ({ transactions, formatCurrency }) => (
  <table className="reports-table">
    <thead>
      <tr><th>Date & Time</th><th>Type</th><th>Instrument</th><th>Quantity</th><th>Price</th><th>Total Value</th></tr>
    </thead>
    <tbody>
      {transactions && transactions.length > 0 ? (
        transactions.map((tx, index) => (
          <tr key={`tx-${index}`}>
            <td>{tx.date}</td>
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
);

// --- Sub-component for P&L Statement Table ---
const PnlStatement = ({ pnlData, formatCurrency }) => (
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
);

// --- Sub-component for Real Return Statement Table ---
const RealReturnStatement = ({ realReturnData, formatCurrency }) => (
  <div>
    <h3>Real Return Statement</h3>
    {/* --- ADDED THIS PARAGRAPH --- */}
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
              <td className="loss">{formatCurrency(rr.inflation_adjustment)}</td> {/* Adjustment is always a reduction */}
              <td className={rr.real_pnl >= 0 ? 'profit' : 'loss'}>{formatCurrency(rr.real_pnl)}</td>
            </tr>
          ))
        ) : ( <tr><td colSpan="4" style={{ textAlign: 'center' }}>No Real Return data. Sell assets to see data here.</td></tr> )}
      </tbody>
    </table>
  </div>
);


// --- Sub-component for CIBIL Score View ---
// --- Sub-component for CIBIL Score View (IMPROVED UI) ---
const CibilScoreView = ({ cibilData }) => {
    if (!cibilData) return <div>No CIBIL score data available.</div>;

    const { score, feedback } = cibilData; // We mainly need the score and feedback labels now
    // Calculate percentage based on the score range (300-900)
    const scorePercentage = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));

    // Determine relevant improvement tips based on feedback labels
    const improvementTips = [];
    if (feedback?.Diversification === "Needs Improvement") improvementTips.push("Diversify your portfolio by investing in different stocks or asset classes (like bonds or FDs).");
    if (feedback?.Profitability === "Average" || feedback?.Profitability === "Needs Improvement") improvementTips.push("Review past trades to refine your investment strategy for better profitability.");
    if (feedback?.Discipline === "Just Started!" || feedback?.Discipline === "Building Habits") improvementTips.push("Focus on long-term investing; holding investments for longer periods often leads to better results.");

    // Function to get color based on feedback
    const getFeedbackColor = (label) => {
        switch (label) {
            case "Excellent": return 'var(--profit-color)'; // Use CSS variables
            case "Good": return 'var(--warning-color)';
            case "Average": return 'var(--warning-color)';
            case "Needs Improvement": return 'var(--loss-color)';
            case "Just Started!": return 'var(--neutral-color)';
            case "Building Habits": return 'var(--neutral-color)';
            case "Getting Consistent": return 'var(--warning-color)';
            case "Long-Term Focused": return 'var(--profit-color)';
            case "Veteran Investor!": return 'var(--profit-color)';
            default: return '#555'; // Default color
        }
    };

    return (
        <div className="cibil-score-view improved-layout">
            {/* --- GAUGE VISUALIZATION (Centered) --- */}
            <div className="cibil-gauge-container improved-gauge">
                <div className="cibil-gauge">
                    <div className="cibil-gauge-fill" style={{ transform: `rotate(${scorePercentage * 1.8}deg)` }}></div>
                    <div className="cibil-gauge-cover">
                        <div className="cibil-score-value">{score}</div>
                        <div className="cibil-score-label">Investment Score</div>
                    </div>
                </div>
            </div>

            {/* --- NEW "SCORE FACTORS" SECTION --- */}
            <div className="cibil-factors">
                <h4>Score Factors:</h4>
                <div className="factor-item">
                    <span>Diversification:</span>
                    <strong style={{ color: getFeedbackColor(feedback?.Diversification) }}>
                        {feedback?.Diversification || 'N/A'}
                    </strong>
                </div>
                 <div className="factor-item">
                    <span>Profitability:</span>
                    <strong style={{ color: getFeedbackColor(feedback?.Profitability) }}>
                        {feedback?.Profitability || 'N/A'}
                    </strong>
                </div>
                 <div className="factor-item">
                    <span>Discipline:</span>
                    <strong style={{ color: getFeedbackColor(feedback?.Discipline) }}>
                        {feedback?.Discipline || 'N/A'}
                    </strong>
                </div>
            </div>

            {/* --- IMPROVEMENT TIPS (Clearer Section) --- */}
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

