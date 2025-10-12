import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import './DashboardPage.css';

function DashboardPage() {
  // ... (useState, useEffect, loading, and error handling code remains exactly the same)
  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:5000/dashboard/summary');
        setSummaryData(response.data);
      } catch (err) {
        setError('Failed to fetch summary data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div>Loading Dashboard...</div>;
  if (error) return <div className="error">{error}</div>;
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28'];

// In frontend/src/pages/DashboardPage.js

return (
    <div className="dashboard-container">
      <div className="stats-cards">
        <div className="card">
          <h3>Portfolio Value</h3>
          {/* --- CHANGE THIS LINE --- */}
          <p>
            {summaryData.totalPortfolioValue.toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR',
              minimumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="card">
          <h3>Net Profit/Loss</h3>
          {/* --- AND CHANGE THIS LINE --- */}
          <p className={summaryData.totalProfitLoss >= 0 ? 'profit' : 'loss'}>
            {summaryData.totalProfitLoss.toLocaleString('en-IN', {
              style: 'currency',
              currency: 'INR',
              minimumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      {/* The rest of the file (charts-container) remains exactly the same */}
      <div className="charts-container">
        <div className="line-charts-wrapper">
          <div className="chart-card">
            <h3>Portfolio Value History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summaryData.portfolioHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value)} />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          <div className="chart-card">
            <h3>Profit/Loss History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={summaryData.profitLossHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value)} />
                <Legend />
                <ReferenceLine y={0} stroke="#000" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="pnl" stroke="#82ca9d" name="P/L" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="chart-card">
          <h3>Account Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
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
              <Tooltip formatter={(value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;