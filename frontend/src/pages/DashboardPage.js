import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { toast } from 'react-toastify';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import './DashboardPage.css';

// Define consistent colors for charts
const COLORS = ['#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#e74c3c', '#1abc9c'];

// Helper function to format currency
const formatCurrency = (value) => {
  if (typeof value !== 'number') return 'N/A';
  return value.toLocaleString('en-IN', { // Use 'en-IN' locale
    style: 'currency',
    currency: 'INR', // Set currency to INR
    minimumFractionDigits: 2,
  });
};


// --- Main Dashboard Component ---
function DashboardPage() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState(null);
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
        // Fetch summary data from the backend using relative URL (proxy)
        const response = await axios.get(`/dashboard/summary?username=${user.username}`);
        setData(response.data);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setError('Failed to fetch dashboard data.');
        toast.error('Failed to fetch dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    
    // Set up a refresh interval for the dashboard (e.g., every 60 seconds)
    const intervalId = setInterval(fetchData, 60000); 

    // Cleanup function to clear the interval
    return () => clearInterval(intervalId);
  }, [user]);

  if (loading) {
    return <Spinner />;
  }

  if (error || !data) {
    return (
        <div className="dashboard-container">
            <div className="dashboard-error">{error || 'No data available.'}</div>
        </div>
    );
  }

  // Calculate Asset Allocation percentages for the Pie Chart
  const totalAllocValue = data.assetAllocation.reduce((sum, item) => sum + item.value, 0);
  const pieChartData = data.assetAllocation.map((item, index) => ({
    name: item.name,
    value: item.value,
    percentage: totalAllocValue > 0 ? (item.value / totalAllocValue) * 100 : 0,
    fill: COLORS[index % COLORS.length],
  }));

  // Prepare P&L History for the Chart
  // We add a 'fill' color property to the data objects based on PnL
  const chartData = data.profitLossHistory.map(item => ({
    name: item.name,
    pnl: item.pnl,
    value: item.value, // Assuming backend sends total value here if needed, otherwise generic
  }));

  const totalReturn = data.totalProfitLoss;
  const returnClass = totalReturn >= 0 ? 'metric-profit' : 'metric-loss';


  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1 className="dashboard-title">
            Overview
        </h1>
        <span className="welcome-text">Welcome back, {user.full_name || user.username}</span>
      </div>

      <div className="metric-cards-grid">
        {/* --- METRIC CARD 1: Total Portfolio Value --- */}
        <div className="dashboard-widget metric-card primary-metric">
          <div className="metric-icon-wrapper">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div>
            <div className="metric-label">Net Worth</div>
            <div className="metric-value">
                {formatCurrency(data.totalPortfolioValue)}
            </div>
          </div>
        </div>

        {/* --- METRIC CARD 2: Total P&L --- */}
        <div className={`dashboard-widget metric-card ${returnClass}`}>
           <div className="metric-icon-wrapper">
            {totalReturn >= 0 ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
            )}
          </div>
          <div>
            <div className="metric-label">Total Returns</div>
            <div className="metric-value">
                {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
            </div>
            <div className="metric-subtext">
                Unrealized: {formatCurrency(data.unrealizedPnl)} • Realized: {formatCurrency(data.realizedPnl)}
            </div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {/* --- CHART 1: Asset Allocation Pie Chart --- */}
        <div className="dashboard-widget chart-widget allocation-widget">
          <h3 className="widget-title">Asset Allocation</h3>
          <div className="chart-content">
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                >
                    {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                    ))}
                </Pie>
                <Tooltip 
                    formatter={(value) => formatCurrency(value)} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                </PieChart>
            </ResponsiveContainer>
            <div className="allocation-legend">
                {pieChartData.map((entry, index) => (
                <div key={`legend-${index}`} className="legend-item">
                    <span className="legend-dot" style={{ backgroundColor: entry.fill }}></span>
                    <div className="legend-text">
                        <span className="legend-name">{entry.name}</span>
                        <span className="legend-percent">{entry.percentage.toFixed(1)}%</span>
                    </div>
                </div>
                ))}
            </div>
          </div>
        </div>

        {/* --- CHART 2: Profit/Loss History (Area Chart) --- */}
        <div className="dashboard-widget chart-widget history-widget">
          <h3 className="widget-title">Performance History</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3498db" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3498db" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#999', fontSize: 12}} 
                dy={10}
              />
              <YAxis 
                tickFormatter={(val) => `₹${val}`} 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#999', fontSize: 12}} 
              />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area 
                type="monotone" 
                dataKey="pnl" 
                stroke="#3498db" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorPnl)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;