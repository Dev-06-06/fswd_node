// In frontend/src/components/Navbar.js
import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import './Navbar.css'; // We will create this file for styling

function Navbar() {
  const { user, logout } = useContext(AuthContext);

  return (
    <nav className="navbar">
      <div className="navbar-logo">
        <Link to="/">MyPortfolio</Link>
      </div>
      <ul className="navbar-links">
        {user && ( // Only show these links if a user is logged in
          <>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/holdings">Holdings</Link></li>
            <li><Link to="/reports">Reports</Link></li>
            <li><Link to="/account">Account</Link></li>
            <li><button onClick={logout} className="logout-button">Logout</button></li>
          </>
        )}
      </ul>
    </nav>
  );
}

export default Navbar;