import React from 'react';
import { FaHome, FaInfoCircle, FaMoneyBillWave } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';

function TenantDashboard() {
  const navItems = [
    { label: 'Dashboard', path: '/tenant-dashboard', icon: FaHome },
    { label: 'View Information', path: '/tenant-dashboard/view-page', icon: FaInfoCircle },
    { label: 'View Payments', path: '/tenant-dashboard/view-payments', icon: FaMoneyBillWave }
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Tenant"
      userRole="Tenant"
      dashboardTitle="Tenant Dashboard"
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome, Tenant!
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
          value="€ 0"
          icon={FaMoneyBillWave}
          color="blue"
        />
        <StatsCard
          title="Paid This Month"
          value="€ 0"
          icon={FaMoneyBillWave}
          color="green"
        />
        <StatsCard
          title="Pending Payments"
          value="0"
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

