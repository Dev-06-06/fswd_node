import React, { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import './AccountPage.css';

function AccountPage() {
  const { user, updateUser, logout } = useContext(AuthContext);

  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name || '');

  // Update local state if global user context changes
  useEffect(() => {
    setFullName(user.full_name || '');
  }, [user.full_name]);

  const defaultProfilePic = 'https://i.pravatar.cc/150';
  const profilePicUrl = user.profilePicUrl || defaultProfilePic;

  const handleUpdate = async () => {
    try {
      await axios.put('http://127.0.0.1:5000/api/account/profile', {
        username: user.username,
        full_name: fullName
      });
      updateUser({ full_name: fullName });
      alert('Name updated successfully!');
      setIsEditing(false);
    } catch (err) {
      alert('Failed to update name.');
      console.error(err);
    }
  };

  const handleDelete = async () => {
    // ... (delete functionality is unchanged)
  };

  return (
    <div className="account-container">
      <h2>Your Account</h2>
      <div className="profile-card">
        <img src={profilePicUrl} alt="Profile" className="profile-pic" />
        <div className="profile-info">
          {!isEditing ? (
            <>
              <h3>{user.full_name || 'Your Name'}</h3>
              <p><strong>Username:</strong> {user.username}</p>
              <button onClick={() => setIsEditing(true)} className="edit-button">Edit Name</button>
            </>
          ) : (
            <div className="edit-form">
              <h3>Edit Your Name</h3>
              <label>Full Name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <div className="edit-buttons">
                <button onClick={handleUpdate} className="save-button">Save</button>
                <button onClick={() => setIsEditing(false)} className="cancel-button">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="account-actions">
        {/* ... (delete account section is unchanged) ... */}
      </div>
    </div>
  );
}

export default AccountPage;
