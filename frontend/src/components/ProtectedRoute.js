import React from 'react';
import { Navigate } from 'react-router-dom';
import jwtDecode from 'jwt-decode';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const token = localStorage.getItem('token');
  
  // No token = redirect to login
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  try {
    // Decode token to get user info
    const decoded = jwtDecode(token);
    const userRole = decoded.role;
    
    // Check token expiration
    const currentTime = Date.now() / 1000;
    if (decoded.exp && decoded.exp < currentTime) {
      // Token expired
      localStorage.removeItem('token');
      return <Navigate to="/" replace />;
    }
    
    // Check if user's role is allowed for this route
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      // Redirect to correct dashboard based on actual role
      if (userRole === 'Site-admin') {
        return <Navigate to="/admin-dashboard" replace />;
      }
      if (userRole === 'Administrator') {
        return <Navigate to="/building-administrator" replace />;
      }
      if (userRole === 'Tenant') {
        return <Navigate to="/tenant-dashboard" replace />;
      }
      // If unknown role, redirect to login
      return <Navigate to="/" replace />;
    }
    
    // All checks passed - render the protected component
    return children;
    
  } catch (error) {
    // Invalid token format
    console.error('Invalid token:', error);
    localStorage.removeItem('token');
    return <Navigate to="/" replace />;
  }
};

export default ProtectedRoute;
