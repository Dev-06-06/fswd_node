import React, { useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './AccountPage.css';

function AccountPage() {
  const { user, logout } = useContext(AuthContext);

  // Function to get initials from name or username
  const getInitials = (name, username) => {
    if (name) {
      const names = name.split(' ');
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    // Ensure username is not null/undefined before accessing substring
    return username ? username.substring(0, 2).toUpperCase() : '??';
  };

  // Check if user exists before trying to get initials
  const initials = user ? getInitials(user.full_name, user.username) : '??';
  // Generate a placeholder image URL with initials
  const placeholderImageUrl = `https://placehold.co/150x150/3498db/FFFFFF?text=${initials}`;

  // Use the full_name if available, otherwise fallback to username
  const displayName = user?.full_name || user?.username;

  // No longer need profileDetails for uniqueId

  const handleDelete = async () => {
    // Use window.confirm for critical actions
    const isConfirmed = window.confirm(
      'Are you sure you want to delete your account? This action is irreversible and will remove all your data.'
    );

    if (isConfirmed && user?.username) {
      try {
        await axios.delete('http://127.0.0.1:5000/api/account/delete', {
          data: { username: user.username }
        });
        toast.success('Account deleted successfully.');
        logout(); // Log the user out and redirect them
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete account.');
        console.error(err);
      }
    } else if (!user?.username) {
         toast.error("Cannot delete account: User information is missing.");
    }
  };

  // Ensure user object exists before rendering
  if (!user) {
    // Or display a loading spinner/message
    return <div>Loading account details...</div>;
  }

  return (
    <div className="account-container">
      <h2>Your Account</h2>
      <div className="profile-card">
        <img src={placeholderImageUrl} alt="Profile Initials" className="profile-pic" />
        <div className="profile-info">
          <h3>{displayName}</h3>
          <p><strong>Username:</strong> {user.username}</p>
          {/* --- REMOVED UNIQUE ID LINE --- */}
        </div>
      </div>
      <div className="account-actions">
        <h3>Account Management</h3>
        <button onClick={handleDelete} className="delete-button">
          Delete Account
        </button>
      </div>
    </div>
  );
}

export default AccountPage;

