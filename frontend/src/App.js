import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './App.css';
import './Auth.css';
import axios from 'axios';

// Import Context and Components
import { AuthContext } from './context/AuthContext';
import AuthForm from './AuthForm';
import Navbar from './components/Navbar';
import WelcomeModal from './components/WelcomeModal';
import Spinner from './components/Spinner';

// Import Page Components
import DashboardPage from './pages/DashboardPage';
import HoldingsPage from './pages/HoldingsPage';
import ReportsPage from './pages/ReportsPage';
import AccountPage from './pages/AccountPage';

// --- COMPONENT: KiteCallbackHandler ---
const KiteCallbackHandler = () => {
  const { search } = useLocation();
  const navigate = useNavigate();
  const { user, updateKiteStatus, showModal } = useContext(AuthContext);
  const effectRan = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const requestToken = params.get('request_token');
    const status = params.get('status');

    if (
      status === 'success' &&
      requestToken &&
      user?.username &&
      !effectRan.current
    ) {
      effectRan.current = true;
      console.log('Kite callback detected. Processing token...');

      const handleCallback = async () => {
        try {
          const response = await fetch('/api/broker/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request_token: requestToken,
              username: user.username,
            }),
          });
          const data = await response.json();
          if (response.ok) {
            updateKiteStatus(data.public_token);
            showModal('Zerodha account connected successfully!', 'success');
          } else {
            showModal(data.message || 'Failed to connect.', 'error');
          }
        } catch (err) {
          console.error('Callback API error:', err);
          showModal('An error occurred. Please try again.', 'error');
        } finally {
          navigate('/account', { replace: true });
        }
      };
      handleCallback();
    }
  }, [search, user, navigate, updateKiteStatus, showModal]);

  return null;
};
// --- END OF COMPONENT ---

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
  const { user, updateUser, isAuthenticated, isLoading } = useContext(AuthContext);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !user.full_name) {
      setShowWelcomeModal(true);
    } else {
      setShowWelcomeModal(false);
    }
  }, [user, isAuthenticated]);

  // --- THIS FUNCTION IS UPDATED ---
  const handleNameConfirm = async (name) => {
    try {
      const response = await fetch(`/api/account/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          full_name: name,
          // --- REMOVED profile_pic_url ---
        }),
      });

      if (!response.ok) throw new Error('Failed to save name');

      updateUser({ full_name: name });
      setShowWelcomeModal(false);
    } catch (err) {
      console.error('Could not save name:', err);
    }
  };
  // --- END OF UPDATE ---

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <>
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

      {isAuthenticated && <Navbar />}
      {showWelcomeModal && <WelcomeModal onConfirm={handleNameConfirm} />}
      {isAuthenticated && <KiteCallbackHandler />}

      <div className="main-content">
        <Routes>
          <Route path="/" element={isAuthenticated ? <DashboardPage /> : <Navigate to="/login" />} />
          <Route path="/holdings" element={isAuthenticated ? <HoldingsPage /> : <Navigate to="/login" />} />
          <Route path="/reports" element={isAuthenticated ? <ReportsPage /> : <Navigate to="/login" />} />
          <Route path="/account" element={isAuthenticated ? <AccountPage /> : <Navigate to="/login" />} />
          <Route path="/redirect" element={isAuthenticated ? <AccountPage /> : <Navigate to="/login" />} />
          <Route path="/login" element={!isAuthenticated ? <AuthPage /> : <Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

export default App;