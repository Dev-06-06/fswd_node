import React, { useState, useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify'; // --- 1. IMPORT TOAST CONTAINER ---
import 'react-toastify/dist/ReactToastify.css'; // --- 2. IMPORT THE CSS ---
import './App.css';
import './Auth.css';
import axios from 'axios';

// Import Context and Components
import { AuthContext } from './context/AuthContext';
import AuthForm from './AuthForm';
import Navbar from './components/Navbar';
import WelcomeModal from './components/WelcomeModal';

// Import Page Components
import DashboardPage from './pages/DashboardPage';
import HoldingsPage from './pages/HoldingsPage';
import ReportsPage from './pages/ReportsPage';
import AccountPage from './pages/AccountPage';

// ... (The AuthPage function remains exactly the same)
function AuthPage() {
  const [showLogin, setShowLogin] = useState(true);
  return (
    <div className="auth-page-container">
      <div className="branding-panel">
        <h1>MyPortfolio</h1>
        <p>Your complete solution for managing investments and tracking your financial growth.</p>
      </div>
      <div className="form-panel">
        <div className="auth-card">
          <AuthForm formType={showLogin ? 'Login' : 'Register'} />
          <button onClick={() => setShowLogin(!showLogin)} className="toggle-auth">
            {showLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
}


function App() {
  const { user, updateUser } = useContext(AuthContext);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (user && !user.full_name) {
      setShowWelcomeModal(true);
    } else {
      setShowWelcomeModal(false);
    }
  }, [user]);

  const handleNameConfirm = async (name) => {
    try {
      await axios.put(`http://127.0.0.1:5000/api/account/profile`, {
        username: user.username,
        full_name: name
      });
      updateUser({ full_name: name });
      setShowWelcomeModal(false);
    } catch (err) {
      alert("Could not save your name. Please try again later.");
    }
  };

  return (
    <BrowserRouter>
      {/* --- 3. ADD THE TOAST CONTAINER HERE --- */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      {user && <Navbar />}
      {showWelcomeModal && <WelcomeModal onConfirm={handleNameConfirm} />}
      <div className="main-content">
        <Routes>
          <Route path="/" element={user ? <DashboardPage /> : <Navigate to="/login" />} />
          <Route path="/holdings" element={user ? <HoldingsPage /> : <Navigate to="/login" />} />
          <Route path="/reports" element={user ? <ReportsPage /> : <Navigate to="/login" />} />
          <Route path="/account" element={user ? <AccountPage /> : <Navigate to="/login" />} />
          <Route path="/login" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;

