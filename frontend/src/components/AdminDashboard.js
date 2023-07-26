import React, { useState } from 'react';
import { Link, useMatch ,Switch} from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../css/adminDashboard.css';
import ManageUsers from './ManageUser.js';


function AdminDashboard() {
  const [showManageUsers, setShowManageUsers] = useState(false);

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
                <Link className="nav-link" to="/admin/manage-apartments">
                  Manage Apartments
                </Link>
              </li>
            </ul>
            <ul className="navbar-nav ml-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/admin/profile">
                  Profile
                </Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/admin/logout">
                  Logout
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </header>

      <div className="container">
        <h1>Welcome, Admin!</h1>
        <p>Manage your site's content and settings here.</p>

        {/* Conditionally render the ManageUsers component */}
        {match && showManageUsers && <ManageUsers />}
      </div>
    </div>
  );
}

export default AdminDashboard;