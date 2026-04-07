import React, { useEffect, useState } from 'react';
import { FaUser, FaEnvelope, FaUserTag, FaSpinner } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users')
      .then((response) => response.json())
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, []);

  const getRoleBadge = (role) => {
    const roleColors = {
      'Admin': 'badge-danger',
      'Administrator': 'badge-primary',
      'Tenant': 'badge-success',
      'Building Administrator': 'badge-info'
    };
    return roleColors[role] || 'badge-secondary';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <FaSpinner className="spinner-border text-primary" style={{ fontSize: '2rem' }} />
        <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
        <FaUser style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.3 }} />
        <p>No users found</p>
      </div>
    );
  }

  return (
    <div className="table-responsive">
      <table className="table table-hover">
        <thead style={{ backgroundColor: '#f8fafc' }}>
          <tr>
            <th>ID</th>
            <th>
              <FaUser style={{ marginRight: '0.5rem', color: '#2563eb' }} />
              Name
            </th>
            <th>
              <FaEnvelope style={{ marginRight: '0.5rem', color: '#10b981' }} />
              Email
            </th>
            <th>
              <FaUserTag style={{ marginRight: '0.5rem', color: '#8b5cf6' }} />
              Role
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id || user.id}>
              <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                {user._id ? user._id.substring(0, 8) : user.id}
              </td>
              <td style={{ fontWeight: '500' }}>
                {user.name}
              </td>
              <td style={{ color: '#64748b' }}>
                {user.email}
              </td>
              <td>
                <span className={`badge ${getRoleBadge(user.role)}`}>
                  {user.role || 'N/A'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;
