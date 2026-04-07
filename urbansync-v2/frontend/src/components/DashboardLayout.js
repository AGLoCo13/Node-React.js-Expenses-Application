import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaBars, FaTimes, FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import '../css/dashboardLayout.css';

const DashboardLayout = ({ children, navItems, userName, userRole, dashboardTitle }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    window.localStorage.removeItem('token');
    navigate('/');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h3 className="sidebar-logo" style={{ color: 'white' }}>UrbanSync</h3>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.7)', 
            margin: '0.25rem 0 0 0', 
            fontSize: '0.75rem',
            fontStyle: 'italic',
            textAlign: 'center'
          }}>
            Your Building, Simplified
          </p>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <Link
              key={index}
              to={item.path}
              className="sidebar-nav-item"
              onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}
            >
              {item.icon && <item.icon className="nav-icon" />}
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn">
            <FaSignOutAlt className="nav-icon" />
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`main-content ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-left">
            <button className="toggle-btn" onClick={toggleSidebar}>
              {sidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
            <h1 className="dashboard-title">{dashboardTitle}</h1>
          </div>
          
          <div className="header-right">
            <div className="user-info">
              <FaUserCircle className="user-icon" />
              <div className="user-details">
                <span className="user-name">{userName}</span>
                <span className="user-role">{userRole}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="dashboard-content">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && window.innerWidth <= 768 && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
};

export default DashboardLayout;
