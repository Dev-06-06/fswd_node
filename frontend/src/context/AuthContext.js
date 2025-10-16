import React, { createContext, useState, useEffect } from 'react';

// Create the context object
export const AuthContext = createContext();

// Create the provider component
export const AuthProvider = ({ children }) => {
  // 1. The state that holds the logged-in user object
  // We initialize it from localStorage to keep the user logged in after a refresh
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (error) {
      return null;
    }
  });

  // 2. An effect that saves the user to localStorage whenever it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  }, [user]);

  // 3. Function to set the user on successful login
  const login = (userData) => {
    setUser(userData);
  };

  // 4. Function to clear the user on logout
  const logout = () => {
    setUser(null);
  };

  // 5. Function to update parts of the user object (like name or profile pic)
  const updateUser = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  };

  return (
    // 6. Provide the user state and all the functions to the rest of the app
    // This is the line that was previously missing 'updateUser'
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
