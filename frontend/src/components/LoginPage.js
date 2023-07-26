import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/loginPage.css';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Call the login controller with the email and password
      const response = await axios.post('http://localhost:5000/api/login', { email, password });

      // Clear the form fields
      setEmail('');
      setPassword('');
      // Handle the response, e.g., set authentication state, redirect, etc.
      const { token } = response.data;

      // Store the token in local storage

      // Redirect to the admin dashboard or update the state to render the dashboard component
      // Example: setLoggedIn(true);
      window.localStorage.setItem('token', token);
      window.location.href = './admin-dashboard';
    } catch (error) {
      // Handle any error that occurs during login
      console.error(error);
    }
  };

  return (
    <div className="login-page d-flex justify-content-center align-items-center">
      <div className="login-container">
        <h1>Welcome!</h1>
        <p>Please login with the credentials given to you by the site admin.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              className="form-control"
              id="email"
              value={email}
              onChange={handleEmailChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              className="form-control"
              id="password"
              value={password}
              onChange={handlePasswordChange}
            />
          </div>
          <button type="submit" className="btn btn-primary">Login</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;