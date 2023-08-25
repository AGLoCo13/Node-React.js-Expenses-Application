import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route,} from 'react-router-dom';
import axios from 'axios';
import AdminDashboard from './components/AdminDashboard.js';
import LoginPage from './components/LoginPage.js';
import ManageUsers from './components/ManageUser.js';
import ManageBuildings from './components/ManageBuildings.js';
import ManageApartments from './components/ManageApartments.js';
import ViewAdminProfile from './components/ViewAdminProfile.js';
import ViewBuilding from './components/ViewBuilding.js';
import FuelCharge from './components/FuelCharge.js';
import ConsumptionHistory from './components/ConsumptionHistory.js';
import {ToastContainer} from 'react-toastify';
import BuildingAdministratorDashboard from './components/BuildingAdministratorDashboard.js';
import ExpensesCharge from './components/ExpensesCharge.js';
import TenantDashboard from './components/TenantDashboard.js';
import TenantView from './components/TenantView.js';
import ViewExpenses from './components/ViewExpenses.js';
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
        <Route path="/building-administrator" element={<BuildingAdministratorDashboard />} />
        <Route path="/tenant-dashboard" element={<TenantDashboard />} />
        <Route path="/tenant-dashboard/view-page"  element = {<TenantView />} />
        <Route path="/building-administrator/view-building" element={<ViewBuilding />} />
        <Route path="/building-administrator/fuel-charge" element={<FuelCharge />} />
        <Route path="/building-administrator/consumption-history" element={<ConsumptionHistory />} />
        <Route path="/building-administrator/expenses-charge" element={<ExpensesCharge />} />
        <Route path="/building-administrator/view-expenses" element={<ViewExpenses />} />
        <Route path="/admin-dashboard/manage-users" element={<ManageUsers />} />
        <Route path="/admin-dashboard/manage-buildings" element={<ManageBuildings />} />
        <Route path="/admin-dashboard/manage-apartments" element={<ManageApartments />} />
        <Route path="/admin-dashboard/profile" element={<ViewAdminProfile/>} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;