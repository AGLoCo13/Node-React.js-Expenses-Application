import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUsers, FaBuilding, FaDoorOpen, FaUserShield } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import StatsCard from './StatsCard';
import 'bootstrap/dist/css/bootstrap.min.css';

function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBuildings: 0,
    totalApartments: 0
  });

  useEffect(() => {
    // Fetch stats from API
    const fetchStats = async () => {
      try {
        const token = window.localStorage.getItem('token');
        const [usersRes, buildingsRes, apartmentsRes] = await Promise.all([
          axios.get('/api/users', { headers: { Authorization: token } }),
          axios.get('/api/buildings', { headers: { Authorization: token } }),
          axios.get('/api/apartments', { headers: { Authorization: token } })
        ]);

        setStats({
          totalUsers: usersRes.data?.length || 0,
          totalBuildings: buildingsRes.data?.length || 0,
          totalApartments: apartmentsRes.data?.apartments?.length || 0
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: FaHome },
    { label: 'Manage Users', path: '/admin-dashboard/manage-users', icon: FaUsers },
    { label: 'Manage Buildings', path: '/admin-dashboard/manage-buildings', icon: FaBuilding },
    { label: 'Manage Apartments', path: '/admin-dashboard/manage-apartments', icon: FaDoorOpen },
    { label: 'Profile', path: '/admin-dashboard/profile', icon: FaUserShield }
  ];

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Admin"
      userRole="Site Administrator"
      dashboardTitle="Admin Dashboard"
    >
      <div className="welcome-section" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
          Welcome back, Admin!
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Here's an overview of your system. Manage users, buildings, and apartments from the sidebar.
        </p>
      </div>

      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          icon={FaUsers}
          color="blue"
        />
        <StatsCard
          title="Total Buildings"
          value={stats.totalBuildings}
          icon={FaBuilding}
          color="green"
        />
        <StatsCard
          title="Total Apartments"
          value={stats.totalApartments}
          icon={FaDoorOpen}
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
            href="/admin-dashboard/manage-users" 
            className="btn btn-primary" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaUsers style={{ marginRight: '0.5rem' }} />
            Manage Users
          </a>
          <a 
            href="/admin-dashboard/manage-buildings" 
            className="btn btn-success" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaBuilding style={{ marginRight: '0.5rem' }} />
            Manage Buildings
          </a>
          <a 
            href="/admin-dashboard/manage-apartments" 
            className="btn btn-warning" 
            style={{ 
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              textAlign: 'center'
            }}
          >
            <FaDoorOpen style={{ marginRight: '0.5rem' }} />
            Manage Apartments
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default AdminDashboard;
