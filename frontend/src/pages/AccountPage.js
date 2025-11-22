import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './AccountPage.css';
import Spinner from '../components/Spinner';
import ConfirmationModal from '../components/ConfirmationModal';

const AccountPage = () => {
  const { user, logout, isKiteConnected, showModal, updateUser, disconnectKite } = useContext(AuthContext);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const getInitials = (name, username) => {
    if (name) {
      const names = name.split(' ');
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    return username ? username.substring(0, 2).toUpperCase() : '??';
  };

  const initials = user ? getInitials(user.full_name, user.username) : '??';
  const displayProfilePic = `https://placehold.co/100x100/3498db/FFFFFF?text=${initials}`;
  const displayName = fullName || user?.username;

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch('/api/account/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          full_name: fullName,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        showModal('Account updated successfully!', 'success');
        updateUser({ full_name: fullName });
      } else {
        showModal(data.message || 'Failed to update account.', 'error');
      }
    } catch (err) {
      showModal('An error occurred. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectKite = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/broker/connect');
      const data = await response.json();
      if (response.ok && data.login_url) {
        window.location.href = data.login_url;
      } else {
        showModal(data.message || 'Could not get Zerodha login URL.', 'error');
        setIsConnecting(false);
      }
    } catch (err) {
      showModal('Failed to connect. Please try again.', 'error');
      setIsConnecting(false);
    }
  };

  const handleSyncKite = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/broker/sync-holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      const data = await response.json();
      if (response.ok) {
        showModal(data.message || 'Holdings synced successfully!', 'success');
      } else {
        showModal(data.message || 'Failed to sync holdings.', 'error');
      }
    } catch (err) {
      showModal('An error occurred during sync. Please try again.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectKite = async () => {
    setIsDisconnecting(true);
    await disconnectKite();
    setIsDisconnecting(false);
  };

  const confirmDelete = async () => {
    if (!user?.username) {
      showModal("Cannot delete account: User information is missing.", "error");
      return;
    }
    setIsDeleting(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });
      const data = await response.json();
      if (response.ok) {
        showModal('Account deleted successfully.', 'success');
        setIsDeleting(false);
        setIsDeleteModalOpen(false);
        logout();
      } else {
        showModal(data.message || 'Failed to delete account.', 'error');
      }
    } catch (err) {
      showModal(err.message || 'Failed to delete account.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!user) {
    return <div className="account-page-loading"><Spinner /></div>;
  }

  return (
    <div className="account-container">
      <div className="account-header">
        <h1 className="page-title">Account Settings</h1>
      </div>

      {/* --- PROFILE SECTION --- */}
      <div className="account-widget profile-widget">
        <div className="profile-header">
          <div className="profile-avatar">
            <img src={displayProfilePic} alt="Profile" />
          </div>
          <div className="profile-details">
            <h3>{displayName}</h3>
            <span className="profile-username">@{user.username}</span>
          </div>
        </div>
        
        <form onSubmit={handleUpdate} className="profile-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input type="text" id="username" value={user.username} disabled className="input-disabled" />
            </div>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
                className="input-field"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? <Spinner /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* --- BROKER INTEGRATION SECTION --- */}
      <div className="account-widget broker-widget">
        <div className="widget-header">
          <h2 className="widget-title">Broker Integration</h2>
          {isKiteConnected ? (
            <span className="status-badge connected">
              <span className="dot"></span> Connected
            </span>
          ) : (
            <span className="status-badge disconnected">
              <span className="dot"></span> Not Connected
            </span>
          )}
        </div>
        
        <p className="widget-description">
          Connect your Zerodha Kite account to automatically sync your holdings and get real-time price updates for your portfolio.
        </p>
        
        <div className="broker-actions">
          {!isKiteConnected ? (
            <button className="btn-connect" onClick={handleConnectKite} disabled={isConnecting}>
              {isConnecting ? <Spinner /> : 'Connect to Zerodha Kite'}
            </button>
          ) : (
            <>
              <button className="btn-sync" onClick={handleSyncKite} disabled={isSyncing}>
                {isSyncing ? <Spinner /> : 'Sync Holdings Now'}
              </button>
              <button className="btn-disconnect" onClick={handleDisconnectKite} disabled={isDisconnecting}>
                {isDisconnecting ? <Spinner /> : 'Disconnect'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* --- DANGER ZONE --- */}
      <div className="account-widget danger-zone">
        <h2 className="danger-title">Danger Zone</h2>
        <div className="danger-content">
          <p>
            Deleting your account is irreversible. All your data, including holdings and transaction history, will be permanently removed.
          </p>
          <button onClick={() => setIsDeleteModalOpen(true)} className="btn-delete">
            Delete Account
          </button>
        </div>
      </div>

      <ConfirmationModal
        show={isDeleteModalOpen}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action is irreversible and will remove all your data."
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isConfirming={isDeleting}
      />
    </div>
  );
};

export default AccountPage;