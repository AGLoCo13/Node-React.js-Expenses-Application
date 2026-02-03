import React, { useEffect } from 'react';
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
import CalculateExpenses from './components/CalculateExpenses.js';
import ViewPayments from './components/ViewPayment.js';
import TenantPayments from './components/TenantPayments.js';
import ProtectedRoute from './components/ProtectedRoute.js';
function App() {
  useEffect(() => {
    // Check if the user is logged in by verifying the token
    const token = window.localStorage.getItem('token');

    if (token) {
      axios.defaults.headers.common['Authorization'] = token;
    }
  }, []);

  return (
    <Router>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<LoginPage />} />
        
        {/* Site-Admin Routes */}
        <Route path="/admin-dashboard" element={
          <ProtectedRoute allowedRoles={['Site-admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin-dashboard/manage-users" element={
          <ProtectedRoute allowedRoles={['Site-admin']}>
            <ManageUsers />
          </ProtectedRoute>
        } />
        <Route path="/admin-dashboard/manage-buildings" element={
          <ProtectedRoute allowedRoles={['Site-admin']}>
            <ManageBuildings />
          </ProtectedRoute>
        } />
        <Route path="/admin-dashboard/manage-apartments" element={
          <ProtectedRoute allowedRoles={['Site-admin']}>
            <ManageApartments />
          </ProtectedRoute>
        } />
        <Route path="/admin-dashboard/profile" element={
          <ProtectedRoute allowedRoles={['Site-admin']}>
            <ViewAdminProfile />
          </ProtectedRoute>
        } />
        
        {/* Building Administrator Routes */}
        <Route path="/building-administrator" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <BuildingAdministratorDashboard />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/view-building" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <ViewBuilding />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/fuel-charge" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <FuelCharge />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/consumption-history" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <ConsumptionHistory />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/expenses-charge" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <ExpensesCharge />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/view-expenses" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <ViewExpenses />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/calculate-expenses" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <CalculateExpenses />
          </ProtectedRoute>
        } />
        <Route path="/building-administrator/view-payments" element={
          <ProtectedRoute allowedRoles={['Administrator']}>
            <ViewPayments />
          </ProtectedRoute>
        } />
        
        {/* Tenant Routes */}
        <Route path="/tenant-dashboard" element={
          <ProtectedRoute allowedRoles={['Tenant']}>
            <TenantDashboard />
          </ProtectedRoute>
        } />
        <Route path="/tenant-dashboard/view-page" element={
          <ProtectedRoute allowedRoles={['Tenant']}>
            <TenantView />
          </ProtectedRoute>
        } />
        <Route path="/tenant-dashboard/view-payments" element={
          <ProtectedRoute allowedRoles={['Tenant']}>
            <TenantPayments />
          </ProtectedRoute>
        } />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;