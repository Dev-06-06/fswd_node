import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './ReportsPage.css';

function ReportsPage() {
  const { user } = useContext(AuthContext);

  const [activeView, setActiveView] = useState('history');
  const [transactions, setTransactions] = useState([]);
  const [pnlData, setPnlData] = useState([]);
  const [realReturnData, setRealReturnData] = useState([]);
  const [cibilData, setCibilData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all four sets of data concurrently for efficiency
        const [txResponse, pnlResponse, realReturnResponse, cibilResponse] = await Promise.all([
          axios.get(`http://127.0.0.1:5000/api/reports/transactions?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/pnl?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/real-returns?username=${user.username}`),
          axios.get(`http://127.0.0.1:5000/api/reports/cibil-score?username=${user.username}`)
        ]);
        setTransactions(txResponse.data);
        setPnlData(pnlResponse.data);
        setRealReturnData(realReturnResponse.data);
        setCibilData(cibilResponse.data);
      } catch (err) {
        setError('Failed to fetch report data. Please ensure the backend is running and you have transactions.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <div>Loading reports...</div>;
  if (error) return <div className="error">{error}</div>;

  const formatCurrency = (value) => {
    return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Reports</h2>
        <div className="view-toggle">
          <button onClick={() => setActiveView('history')} className={activeView === 'history' ? 'active' : ''}>Transaction History</button>
          <button onClick={() => setActiveView('pnl')} className={activeView === 'pnl' ? 'active' : ''}>P&L Statement</button>
          <button onClick={() => setActiveView('realReturn')} className={activeView === 'realReturn' ? 'active' : ''}>Real Return</button>
          <button onClick={() => setActiveView('cibil')} className={activeView === 'cibil' ? 'active' : ''}>CIBIL Score</button>
        </div>
      </div>

      {activeView === 'history' && <TransactionHistory transactions={transactions} formatCurrency={formatCurrency} />}
      {activeView === 'pnl' && <PnlStatement pnlData={pnlData} formatCurrency={formatCurrency} />}
      {activeView === 'realReturn' && <RealReturnStatement realReturnData={realReturnData} formatCurrency={formatCurrency} />}
      {activeView === 'cibil' && <CibilScoreView cibilData={cibilData} />}
    </div>
  );
}

// --- Sub-component for Transaction History Table ---
const TransactionHistory = ({ transactions, formatCurrency }) => (
  <table className="reports-table">
    <thead><tr><th>Date & Time</th><th>Type</th><th>Instrument</th><th>Quantity</th><th>Price</th><th>Total Value</th></tr></thead>
    <tbody>
      {transactions.length > 0 ? (
        transactions.map((tx, index) => (
          <tr key={index}><td>{tx.date}</td><td><span className={`tx-type ${tx.type.toLowerCase()}`}>{tx.type}</span></td><td>{tx.instrument}</td><td>{tx.quantity}</td><td>{formatCurrency(tx.price)}</td><td>{formatCurrency(tx.quantity * tx.price)}</td></tr>
        ))
      ) : ( <tr><td colSpan="6" style={{ textAlign: 'center' }}>No transactions found.</td></tr> )}
    </tbody>
  </table>
);

// --- Sub-component for P&L Statement Table ---
const PnlStatement = ({ pnlData, formatCurrency }) => (
  <table className="reports-table">
    <thead><tr><th>Instrument</th><th>Total Sale Value</th><th>Cost Basis</th><th>Realized P&L</th></tr></thead>
    <tbody>
      {pnlData.length > 0 ? (
        pnlData.map((pnl, index) => (
          <tr key={index}><td>{pnl.instrument}</td><td>{formatCurrency(pnl.total_sale_value)}</td><td>{formatCurrency(pnl.cost_basis)}</td><td className={pnl.realized_pnl >= 0 ? 'profit' : 'loss'}>{formatCurrency(pnl.realized_pnl)}</td></tr>
        ))
      ) : ( <tr><td colSpan="4" style={{ textAlign: 'center' }}>No realized profit or loss to display. Sell a stock to see data here.</td></tr> )}
    </tbody>
  </table>
);

// --- Sub-component for Real Return Statement Table ---
const RealReturnStatement = ({ realReturnData, formatCurrency }) => (
  <table className="reports-table">
    <thead><tr><th>Instrument</th><th>Nominal P&L</th><th>Inflation Adjustment</th><th>Real P&L (True Profit)</th></tr></thead>
    <tbody>
      {realReturnData.length > 0 ? (
        realReturnData.map((rr, index) => (
          <tr key={index}><td>{rr.instrument}</td><td>{formatCurrency(rr.nominal_pnl)}</td><td className="loss">-{formatCurrency(rr.inflation_adjustment)}</td><td className={rr.real_pnl >= 0 ? 'profit' : 'loss'}><strong>{formatCurrency(rr.real_pnl)}</strong></td></tr>
        ))
      ) : ( <tr><td colSpan="4" style={{ textAlign: 'center' }}>No sales found to calculate real returns.</td></tr> )}
    </tbody>
  </table>
);

// --- Sub-component for CIBIL Score View ---
const CibilScoreView = ({ cibilData }) => {
  if (!cibilData) return <div>Calculating score...</div>;

  const scorePercentage = (cibilData.score - 300) / 600;
  const rotation = -90 + (scorePercentage * 180);

  const getImprovementTips = () => {
    const tips = [];
    if (cibilData.feedback.Diversification !== 'Excellent') {
      tips.push("Consider investing in different stocks or asset classes like bonds and FDs to reduce risk.");
    }
    if (cibilData.feedback.Profitability !== 'Excellent') {
      tips.push("Review your selling strategy. Aim to sell investments for a higher price than you bought them.");
    }
    if (cibilData.feedback.Discipline !== 'Excellent') {
      tips.push("Investing for the long term often yields better results. Try to hold your investments for longer periods.");
    }
    return tips;
  };

  const improvementTips = getImprovementTips();

  return (
    <div className="cibil-container">
      <div className="score-gauge-wrapper">
        <div className="score-gauge">
          <div className="score-gauge-fill" style={{ transform: `rotate(${rotation}deg)` }}></div>
          <div className="score-gauge-cover">
            <div className="score-value">{cibilData.score}</div>
            <div className="score-label">out of 900</div>
          </div>
        </div>
      </div>
      <div className="feedback-section">
        <h3>Score Breakdown</h3>
        <div className="feedback-grid">
          <div className="feedback-card">
            <h4>Diversification</h4>
            <p className={cibilData.feedback.Diversification.toLowerCase().replace(' ', '-')}>{cibilData.feedback.Diversification}</p>
          </div>
          <div className="feedback-card">
            <h4>Profitability</h4>
            <p className={cibilData.feedback.Profitability.toLowerCase()}>{cibilData.feedback.Profitability}</p>
          </div>
          <div className="feedback-card">
            <h4>Discipline</h4>
            <p className={cibilData.feedback.Discipline.toLowerCase().replace(' ', '-')}>{cibilData.feedback.Discipline}</p>
          </div>
        </div>
        <div className="improvement-tips">
          <h4>How to Improve Your Score</h4>
          {improvementTips.length > 0 ? (
            <ul>
              {improvementTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          ) : (
            <p className="profit">Excellent work! Your investment habits are solid. Keep up the great discipline.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;

