import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/loginPage.css';
import jwtDecode from 'jwt-decode';
import buildingImg from '../assets/buildingImage.png';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  //Error state
  const [error , setError] = useState(''); 

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post('/api/login', {email, password});
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
      if(error.response && error.response.status === 401){
         setError('Invalid email or password');
      }else{
      setError('An error occured. Please try again later')
    }
    console.error(error);
  }
  };

  return (
    <div className="login-page d-flex justify-content-center align-items-center">
      <div className='row no-gutters'>
        <div className='col-md-6'>
          <img src={buildingImg} alt="Building image" clasName="img-fluid" />
        </div>
      </div>
      <div className="login-container">
        <h2>Welcome to the RN-Expenses App!</h2>
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
          {error && <div className="alert alert-danger">{error}</div>}
          <button type="submit" className="btn btn-primary">Login</button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;