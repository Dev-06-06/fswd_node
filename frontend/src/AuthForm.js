import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from './context/AuthContext';
import { toast } from 'react-toastify'; // Import toast
import InfoModal from './components/InfoModal'; // Import our new modal

function AuthForm({ formType }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext);

  // State to control the info modal
  const [modalInfo, setModalInfo] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    const endpoint = formType === 'Login' ? '/auth/login' : '/auth/register';
    const url = `http://127.0.0.1:5000${endpoint}`;

    try {
      const response = await axios.post(url, { identifier, password });
      
      if (formType === 'Register') {
        // For registration success, use the detailed modal
        setModalInfo({
          title: 'Registration Successful!',
          message: `Your new unique username is: ${response.data.username}. Please keep it safe and use it to log in.`
        });
      } else { // For login success, use a sleek toast
        toast.success(response.data.message);
        login(response.data.user);
      }
    } catch (error) {
      // For all errors, use an error toast
      toast.error(error.response?.data?.message || 'An unexpected error occurred.');
    }
  };

  return (
    <>
      {/* Conditionally render the modal */}
      {modalInfo && (
        <InfoModal 
          title={modalInfo.title} 
          message={modalInfo.message} 
          onClose={() => setModalInfo(null)} 
        />
      )}

      <div className="auth-logo">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 17L9 11L13 15L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 7H21V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>
      <h2>{formType}</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label htmlFor="identifier">
            {formType === 'Login' ? 'Username, Email, or Phone' : 'Email or Phone Number'}
          </label>
          <input id="identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="submit-button">{formType}</button>
      </form>
    </>
  );
}

export default AuthForm;
