import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaInfoCircle, FaMoneyBillWave, FaFileInvoiceDollar } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';

function TenantDashboard() {
  const [userData, setUserData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const navItems = [
    { label: 'Dashboard', path: '/tenant-dashboard', icon: FaHome },
    { label: 'View Information', path: '/tenant-dashboard/view-page', icon: FaInfoCircle },
    { label: 'View Payments', path: '/tenant-dashboard/view-payments', icon: FaMoneyBillWave },
    { label: 'Building Expenses', path: '/tenant-dashboard/view-expenses', icon: FaFileInvoiceDollar }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = window.localStorage.getItem('token');
        
        // Fetch user profile
        const profileResponse = await axios.get('/api/profile', {
          headers: { Authorization: `${token}` }
        });
        setUserData(profileResponse.data);

        // Fetch apartment
        const apartmentResponse = await axios.get(`/api/apartment/${profileResponse.data.profileId}`, {
          headers: { Authorization: `${token}` }
        });

        // Fetch payments
        const paymentsResponse = await axios.get(`/api/payments/${apartmentResponse.data._id}`);
        setPayments(paymentsResponse.data);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate stats
  const calculateStats = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let pendingBalance = 0;
    let paidThisMonth = 0;
    let pendingCount = 0;

    payments.forEach(payment => {
      const total = payment.total_heating + payment.total_elevator + payment.total_general;
      
      if (!payment.payment_made) {
        pendingBalance += total;
        pendingCount++;
      } else if (payment.month === currentMonth && payment.year === currentYear) {
        paidThisMonth += total;
      }
    });

    return { pendingBalance, paidThisMonth, pendingCount };
  };

  const stats = calculateStats();

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Tenant"}
      userRole="Tenant"
      dashboardTitle="Tenant Dashboard"
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome, {userData?.name || "Tenant"}!
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View your apartment information and track your payments here.
        </p>
      </div>

      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatsCard
          title="Current Balance"
          value={loading ? "..." : `€ ${stats.pendingBalance.toFixed(2)}`}
          icon={FaMoneyBillWave}
          color="blue"
        />
        <StatsCard
          title="Paid This Month"
          value={loading ? "..." : `€ ${stats.paidThisMonth.toFixed(2)}`}
          icon={FaMoneyBillWave}
          color="green"
        />
        <StatsCard
          title="Pending Payments"
          value={loading ? "..." : stats.pendingCount.toString()}
          icon={FaMoneyBillWave}
          color="orange"
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
            href="/tenant-dashboard/view-page" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaInfoCircle style={{ marginRight: '0.5rem' }} />
            View Information
          </a>
          <a 
            href="/tenant-dashboard/view-payments" 
            className="btn btn-success" 
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

export default TenantDashboard;

