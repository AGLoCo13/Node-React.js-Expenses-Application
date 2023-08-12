import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/loginPage.css';
import jwtDecode from 'jwt-decode';


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
      const response = await axios.post('http://localhost:5000/api/login', {email, password});
        // Clear the form fields
        setEmail('');
        setPassword('');
      const {token} = response.data;

      //Decode the token to get the payload
      const decodedToken = jwtDecode(token);
      console.log(decodedToken);
      //Get the user's role from the decoded token 
      const userRole = decodedToken.role;
      //Store the token in local storage
      window.localStorage.setItem('token' , token);
      //Redirect based on the user's role
      if (userRole === 'Site-admin') {
        window.location.href = '/admin-dashboard';
      }else if(userRole === 'Administrator') {
        window.location.href = '/building-administrator';
      }else if (userRole === 'Tenant') {
        window.location.href = '/tenant-dashboard';
      }
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