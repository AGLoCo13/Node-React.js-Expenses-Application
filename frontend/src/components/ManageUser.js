import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUsers, FaBuilding, FaDoorOpen, FaUserShield, FaUserPlus, FaEdit, FaTrash, FaEnvelope, FaPhone, FaMapMarkerAlt, FaLock } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', address: '', cellphone: '', role: '' });
  const [editUser, setEditUser] = useState({ address: '', cellphone: '', role: '' });
  const [selectedUser, setSelectedUser] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);

  const navItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: FaHome },
    { label: 'Manage Users', path: '/admin-dashboard/manage-users', icon: FaUsers },
    { label: 'Manage Buildings', path: '/admin-dashboard/manage-buildings', icon: FaBuilding },
    { label: 'Manage Apartments', path: '/admin-dashboard/manage-apartments', icon: FaDoorOpen },
    { label: 'Profile', path: '/admin-dashboard/profile', icon: FaUserShield }
  ];

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error fetching users');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (selectedUser) {
      setEditUser((prev) => ({ ...prev, [name]: value }));
    } else {
      setNewUser((prev) => ({ ...prev, [name]: value }));
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/register', newUser);
      setNewUser({ name: '', email: '', password: '', address: '', cellphone: '', role: '' });
      fetchUsers();
      setShowCreateForm(false);
      toast.success("User created successfully");
    } catch (error) {
      console.error('Error creating user:', error.response?.data);
      toast.error('Error creating user');
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setEditUser({
      address: user.address || '',
      cellphone: user.cellphone || '',
      role: user.role || 'Tenant',
    });
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const updateUser = async (e) => {
    e.preventDefault();
    try {
      const { address, cellphone, role } = editUser;
      await axios.put(`/api/users/${selectedUser._id}`, { address, cellphone, role });
      setSelectedUser(null);
      setEditUser({ address: '', cellphone: '', role: '' });
      setShowEditForm(false);
      fetchUsers();
      toast.success('User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Error updating user');
    }
  };

  const deleteUser = (user) => {
    setSelectedUser(user);
    setShowConfirmation(true);
  };

  const handleDeleteConfirmation = async (confirmed) => {
    if (confirmed && selectedUser) {
      try {
        await axios.delete(`/api/users/${selectedUser._id}`);
        fetchUsers();
        toast.success('User deleted successfully');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Error deleting user');
      }
    }
    setShowConfirmation(false);
    setSelectedUser(null);
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Admin"
      userRole="Site Administrator"
      dashboardTitle="Manage Users"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaUsers style={{ color: '#2563eb' }} />
          Manage Users
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Create, edit, and manage system users
        </p>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || showEditForm) && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {showEditForm ? <><FaEdit /> Edit User: {selectedUser?.name}</> : <><FaUserPlus /> Create New User</>}
          </h3>
          <form onSubmit={showEditForm ? updateUser : createUser}>
            <div className="row">
              {!showEditForm && (
                <>
                  <div className="col-md-6 form-group">
                    <label><FaUserPlus style={{ marginRight: '0.5rem', color: '#2563eb' }} />Name:</label>
                    <input type="text" className="form-control" name="name" value={newUser.name} onChange={handleInputChange} required />
                  </div>
                  <div className="col-md-6 form-group">
                    <label><FaEnvelope style={{ marginRight: '0.5rem', color: '#2563eb' }} />Email:</label>
                    <input type="email" className="form-control" name="email" value={newUser.email} onChange={handleInputChange} required />
                  </div>
                  <div className="col-md-6 form-group">
                    <label><FaLock style={{ marginRight: '0.5rem', color: '#2563eb' }} />Password:</label>
                    <input type="password" className="form-control" name="password" value={newUser.password} onChange={handleInputChange} required />
                  </div>
                </>
              )}
              <div className="col-md-6 form-group">
                <label><FaMapMarkerAlt style={{ marginRight: '0.5rem', color: '#2563eb' }} />Address:</label>
                <input type="text" className="form-control" name="address" value={showEditForm ? editUser.address : newUser.address} onChange={handleInputChange} required />
              </div>
              <div className="col-md-6 form-group">
                <label><FaPhone style={{ marginRight: '0.5rem', color: '#2563eb' }} />Cellphone:</label>
                <input type="text" className="form-control" name="cellphone" value={showEditForm ? editUser.cellphone : newUser.cellphone} onChange={handleInputChange} required />
              </div>
              <div className="col-md-6 form-group">
                <label><FaUserShield style={{ marginRight: '0.5rem', color: '#2563eb' }} />Role:</label>
                <select className="form-control" name="role" value={showEditForm ? editUser.role : newUser.role} onChange={handleInputChange} required>
                  <option value="">Select a role</option>
                  <option value="Tenant">Tenant</option>
                  <option value="Administrator">Administrator</option>
                  {showEditForm && <option value="Site-admin">Site-admin</option>}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary">
                {showEditForm ? 'Update User' : 'Create User'}
              </button>
              {showEditForm && (
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditForm(false); setSelectedUser(null); setShowCreateForm(true); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
          Users List ({users.length})
        </h3>
        <div className="table-responsive">
          <table className="table table-hover">
            <thead style={{ backgroundColor: '#f8fafc' }}>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td style={{ fontWeight: '500' }}>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`badge ${user.role === 'Site-admin' ? 'badge-danger' : user.role === 'Administrator' ? 'badge-warning' : 'badge-info'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-primary" style={{ marginRight: '0.5rem' }} onClick={() => selectUser(user)}>
                      <FaEdit /> Edit
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteUser(user)}>
                      <FaTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        show={showConfirmation}
        title="Delete User"
        message={`Are you sure you want to delete ${selectedUser?.name}? This action cannot be undone.`}
        onConfirm={() => handleDeleteConfirmation(true)}
        onCancel={() => handleDeleteConfirmation(false)}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </DashboardLayout>
  );
}

export default ManageUsers;
