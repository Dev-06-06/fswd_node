import React, { useState, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Import Context and Components
import { AuthContext } from './context/AuthContext';
import AuthForm from './AuthForm';
import Navbar from './components/Navbar';

// Import Page Components
import DashboardPage from './pages/DashboardPage';
import HoldingsPage from './pages/HoldingsPage';
import ReportsPage from './pages/ReportsPage';
import AccountPage from './pages/AccountPage';

// This component will group our login/register forms for the /login route
function AuthPage() {
  const [showLogin, setShowLogin] = useState(true);
  return (
    <div className="auth-container">
      <AuthForm formType={showLogin ? 'Login' : 'Register'} />
      <hr />
      <button onClick={() => setShowLogin(!showLogin)}>
        {showLogin ? 'Need to create an account? (Sign Up)' : 'Already have an account? (Login)'}
      </button>
    </div>
  );
}

function App() {
  const { user } = useContext(AuthContext);

  return (
    <BrowserRouter>
      {/* The Navbar will only be shown when a user is logged in */}
      {user && <Navbar />}
      <div className="main-content">
        <Routes>
          {/* If user is logged in, show dashboard. Otherwise, redirect to login */}
          <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
          
          {/* Protected Routes - only accessible if a user is logged in */}
          <Route path="/holdings" element={user ? <HoldingsPage /> : <Navigate to="/login" />} />
          <Route path="/reports" element={user ? <ReportsPage /> : <Navigate to="/login" />} />
          <Route path="/account" element={user ? <AccountPage /> : <Navigate to="/login" />} />
          
          {/* If user is logged in, redirect from /login to dashboard. Otherwise, show AuthPage */}
          <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;