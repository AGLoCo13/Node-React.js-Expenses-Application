import React, { useState } from 'react';
import { Link, useMatch} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/adminDashboard.css';
import ManageUsers from './ManageUser.js';


function AdminDashboard() {
  const [showManageUsers, setShowManageUsers] = useState(false);
  const navigate = useNavigate(); //Import useNavigate hook
   // Function to handle logout
   const handleLogout = () => {
    // Clear the token from local storage (assuming you store it as 'token')
    window.localStorage.removeItem('token');
    // Redirect the user to the login page
    navigate('http://localhost:3000'); // Adjust the path based on your setup
  };

  const handleManageUsersClick = () => {
    setShowManageUsers(true);
  };

  const match = useMatch('/admin-dashboard/manage-users');

  return (
    <div>
      <header>
        <nav className="navbar navbar-expand-lg navbar-light bg-light">
          <Link className="navbar-brand" to="/admin/dashboard">
            Admin Dashboard
          </Link>
          <button
            className="navbar-toggler"
            type="button"
            data-toggle="collapse"
            data-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav">
              <li className="nav-item">
                <Link
                  className="nav-link"
                  to="/admin-dashboard/manage-users"
                  onClick={handleManageUsersClick}
                >
                  Manage Users
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/admin-dashboard/manage-buildings" onClick={handleManageUsersClick}>
                  Manage Buildings
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/admin-dashboard/manage-apartments">
                  Manage Apartments
                </Link>
              </li>
            </ul>
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/admin-dashboard/profile">
                  Profile
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="http://localhost:3000" onClick={handleLogout}>
                  Logout
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <div className="container">
        <h1>Welcome, Admin!</h1>
        <p>Manage users , buildings and apartments by clicking to the corresponding links above.</p>

        {/* Conditionally render the ManageUsers component */}
        {match && showManageUsers && <ManageUsers />}
      </div>
    </div>
  );
}

export default AdminDashboard;