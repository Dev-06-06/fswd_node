import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import './DashboardPage.css'; // Ensure you have the corresponding CSS file

function DashboardPage() {
  const { user } = useContext(AuthContext);
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!user) { setLoading(false); return; }
      setLoading(true);
      try {
        const response = await axios.get(`http://127.0.0.1:5000/dashboard/summary?username=${user.username}`);
        setSummaryData(response.data);
      } catch (err) {
        setError('Failed to fetch summary data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
        <div className="dashboard-container">
            <Spinner />
        </div>
    );
  }

  if (error) return <div className="error">{error}</div>;

  // Check if summaryData exists and has necessary properties before rendering
  if (!summaryData || summaryData.portfolioHistory === undefined || summaryData.profitLossHistory === undefined || summaryData.assetAllocation === undefined) {
      return (
          <div className="dashboard-container">
              <h2>Welcome, {user.full_name || user.username}!</h2>
              <p>Your dashboard is currently empty or data is unavailable. Go to the Holdings page to add investments!</p>
          </div>
      );
  }


  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']; // Added more colors if needed
  const formatCurrency = (value) => value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 });

  return (
    <div className="dashboard-container">
      {/* --- STATS CARDS --- */}
      <div className="stats-cards">
        <div className="card">
          <h3>Portfolio Value</h3>
          <p>{formatCurrency(summaryData.totalPortfolioValue)}</p>
        </div>
        <div className="card">
          <h3>Net Profit/Loss</h3>
          <p className={summaryData.totalProfitLoss >= 0 ? 'profit' : 'loss'}>
            {formatCurrency(summaryData.totalProfitLoss)}
          </p>
          <div className="pnl-breakdown">
            <span>Unrealized: {formatCurrency(summaryData.unrealizedPnl)}</span>
            <span>Realized: {formatCurrency(summaryData.realizedPnl)}</span>
          </div>
        </div>
      </div>

      {/* --- CHARTS CONTAINER --- */}
      <div className="charts-container">
        {/* Wrapper for the two line charts */}
        <div className="line-charts-wrapper">
          {/* Portfolio Value History */}
          <div className="chart-card">
            <h3>Portfolio Value History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summaryData.portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" name="Value" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Profit/Loss History */}
          <div className="chart-card">
            <h3>Profit/Loss History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summaryData.profitLossHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P/L" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Overview Pie Chart */}
        <div className="chart-card">
          <h3>Account Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            {summaryData.assetAllocation && summaryData.assetAllocation.length > 0 ? (
              <PieChart>
                <Pie
                  data={summaryData.assetAllocation}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {summaryData.assetAllocation.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            ) : (
              <div style={{ textAlign: 'center', paddingTop: '50px', color: '#888' }}>No asset allocation data available.</div>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

