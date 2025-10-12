import React, { useContext } from 'react';
import axios from 'axios'; // Import axios
import { AuthContext } from '../context/AuthContext';
import './AccountPage.css';

function AccountPage() {
  const { user, logout } = useContext(AuthContext); // Get the logout function

  // Define the default picture URL
  const defaultProfilePic = 'https://i.pravatar.cc/150';

  // Use the user's picture if it exists, otherwise use the default
  const profilePicUrl = user.profilePicUrl || defaultProfilePic;

  const profileDetails = {
    name: 'Arjun Kumar',
    uniqueId: 'INV-847294'
  };

  // --- ADD THIS FUNCTION BACK ---
  const handleDelete = async () => {
    const isConfirmed = window.confirm(
      'Are you sure you want to delete your account? This action is irreversible.'
    );

    if (isConfirmed) {
      try {
        await axios.delete('http://127.0.0.1:5000/api/account/delete', {
          data: { username: user.username } 
        });
        alert('Account deleted successfully.');
        logout(); // Log the user out and redirect them
      } catch (err) {
        alert('Failed to delete account. Please try again.');
        console.error(err);
      }
    }
  };

  return (
    <div className="account-container">
      <h2>Your Account</h2>
      <div className="profile-card">
        <img src={profilePicUrl} alt="Profile" className="profile-pic" />
        <div className="profile-info">
          <h3>{profileDetails.name}</h3>
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Unique ID:</strong> {profileDetails.uniqueId}</p>
        </div>
      </div>

      {/* --- ADD THIS SECTION BACK --- */}
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