import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaBuilding, FaFire, FaFileInvoiceDollar, FaCalculator, FaMoneyBillWave, FaHistory } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';

function BuildingAdministratorDashboard() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = window.localStorage.getItem('token');
        const response = await axios.get('/api/profile', {
          headers: { Authorization: `${token}` }
        });
        setUserData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };
    fetchUserData();
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/building-administrator', icon: FaHome },
    { label: 'View Building', path: '/building-administrator/view-building', icon: FaBuilding },
    { label: 'Fuel Charge', path: '/building-administrator/fuel-charge', icon: FaFire },
    { label: 'Expenses Charge', path: '/building-administrator/expenses-charge', icon: FaFileInvoiceDollar },
    { label: 'View Expenses', path: '/building-administrator/view-expenses', icon: FaHistory },
    { label: 'Calculate Expenses', path: '/building-administrator/calculate-expenses', icon: FaCalculator },
    { label: 'View Payments', path: '/building-administrator/view-payments', icon: FaMoneyBillWave }
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Administrator"}
      userRole="Building Administrator"
      dashboardTitle="Building Administrator"
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome, {userData?.name || "Building Administrator"}!
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Manage your building's expenses, track payments, and calculate monthly charges.
        </p>
      </div>

      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatsCard
          title="Total Expenses"
          value="€ 0"
          icon={FaFileInvoiceDollar}
          color="orange"
        />
        <StatsCard
          title="Pending Payments"
          value="0"
          icon={FaMoneyBillWave}
          color="red"
        />
        <StatsCard
          title="This Month"
          value="€ 0"
          icon={FaCalculator}
          color="blue"
        />
      </div>

      <div className="quick-actions" style={{
        backgroundColor: 'white',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
          Quick Actions
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <a 
            href="/building-administrator/expenses-charge" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaFileInvoiceDollar style={{ marginRight: '0.5rem' }} />
            Charge Expenses
          </a>
          <a 
            href="/building-administrator/calculate-expenses" 
            className="btn btn-success" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaCalculator style={{ marginRight: '0.5rem' }} />
            Calculate Expenses
          </a>
          <a 
            href="/building-administrator/view-payments" 
            className="btn btn-warning" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaMoneyBillWave style={{ marginRight: '0.5rem' }} />
            View Payments
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default BuildingAdministratorDashboard;
