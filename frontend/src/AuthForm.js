import React, { useState, useContext } from 'react'; // Import useContext
import axios from 'axios';
import { AuthContext } from './context/AuthContext'; // Import our context

function AuthForm({ formType }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useContext(AuthContext); // Get the login function from context

  const handleSubmit = async (event) => {
    event.preventDefault();
    const endpoint = formType === 'Login' ? '/auth/login' : '/auth/register';
    const url = `http://127.0.0.1:5000${endpoint}`;

    try {
      const response = await axios.post(url, { username, password });
      alert(response.data.message);
      
      // If login was successful, update the global state
      if (formType === 'Login') {
        login(response.data.user);  // Set the user in the global context
      }
    } catch (error) {
      alert(error.response.data.message);
    }
  };

  // ... the rest of the file (return statement) remains exactly the same
  return (
    <div>
      <h2>{formType}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Username: </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password: </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{formType}</button>
      </form>
    </div>
  );
}

export default AuthForm;