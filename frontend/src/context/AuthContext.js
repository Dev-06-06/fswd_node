import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import InfoModal from '../components/InfoModal';

// Create the context
export const AuthContext = createContext();

// Create the provider
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [modalInfo, setModalInfo] = useState({ show: false, message: '', type: '' });
  const [isKiteConnected, setIsKiteConnected] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const checkLoggedInStatus = () => {
      try {
        const storedUser = localStorage.getItem('fswd-user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
          if (parsedUser.kite_public_token) {
            setIsKiteConnected(true);
          }
        }
      } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('fswd-user');
      } finally {
        setIsLoading(false);
      }
    };
    checkLoggedInStatus();
  }, []);

  const login = (userData) => {
    try {
      localStorage.setItem('fswd-user', JSON.stringify(userData));
      setUser(userData);
      setIsAuthenticated(true);
      if (userData.kite_public_token) {
        setIsKiteConnected(true);
      } else {
        setIsKiteConnected(false);
      }
      navigate('/');
    } catch (error) {
      console.error("Login failed:", error);
      showModal('Login failed. Please try again.', 'error');
    }
  };

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('fswd-user');
      setUser(null);
      setIsAuthenticated(false);
      setIsKiteConnected(false);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      showModal('Logout error. Please try again.', 'error');
    }
  }, [navigate]);

  const updateKiteStatus = (publicToken) => {
    setIsKiteConnected(true);
    setUser(currentUser => {
      const updatedUser = { ...currentUser, kite_public_token: publicToken };
      localStorage.setItem('fswd-user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  const updateUser = (updatedInfo) => {
    setUser(currentUser => {
      const updatedUser = { ...currentUser, ...updatedInfo };
      localStorage.setItem('fswd-user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  // --- THIS IS THE NEW FUNCTION ---
  const disconnectKite = async () => {
    // 1. Clear frontend state immediately
    setIsKiteConnected(false);
    setUser(currentUser => {
      const updatedUser = { ...currentUser };
      delete updatedUser.kite_public_token; // Remove the token
      localStorage.setItem('fswd-user', JSON.stringify(updatedUser));
      return updatedUser;
    });

    // 2. Tell backend to clear its token too
    try {
      await fetch('/api/broker/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      showModal('Kite account disconnected successfully.', 'success');
    } catch (err) {
      console.error("Failed to disconnect on backend:", err);
      showModal('Disconnected from frontend. Backend may still be linked.', 'error');
    }
  };
  // --- END OF NEW FUNCTION ---

  const showModal = (message, type = 'info', title = 'Notification') => {
    setModalInfo({ show: true, message, type, title });
  };
  
  const closeModal = () => {
    setModalInfo({ show: false, message: '', type: '' });
  };

  const contextValue = {
    isAuthenticated,
    user,
    isLoading,
    isKiteConnected,
    login,
    logout,
    updateKiteStatus,
    updateUser,
    disconnectKite, // <-- Add new function
    showModal,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
      {modalInfo.show && (
        <InfoModal 
          show={modalInfo.show} 
          title={modalInfo.title}
          message={modalInfo.message} 
          type={modalInfo.type} 
          onClose={closeModal} 
        />
      )}
    </AuthContext.Provider>
  );
};