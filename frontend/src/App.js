import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route,} from 'react-router-dom';
import axios from 'axios';
import AdminDashboard from './components/AdminDashboard.js';
import LoginPage from './components/LoginPage.js';
import ManageUsers from './components/ManageUser.js';
import ManageBuildings from './components/ManageBuildings.js';
import {ToastContainer} from 'react-toastify';
function App() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    // Check if the user is logged in by verifying the token
    const token = window.localStorage.getItem('token');

    if (token) {
      axios.defaults.headers.common['Authorization'] = token;
      setLoggedIn(true);
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/admin-dashboard/manage-users" element={<ManageUsers />} />
        <Route path="/admin-dashboard/manage-buildings" element={<ManageBuildings />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;