import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUsers, FaBuilding, FaDoorOpen, FaUserShield, FaEdit, FaSave, FaTimes, FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ViewAdminProfile() {
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState({});
  const [loading, setLoading] = useState(true);

  const navItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: FaHome },
    { label: 'Manage Users', path: '/admin-dashboard/manage-users', icon: FaUsers },
    { label: 'Manage Buildings', path: '/admin-dashboard/manage-buildings', icon: FaBuilding },
    { label: 'Manage Apartments', path: '/admin-dashboard/manage-apartments', icon: FaDoorOpen },
    { label: 'Profile', path: '/admin-dashboard/profile', icon: FaUserShield }
  ];

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = window.localStorage.getItem('token');
      const response = await axios.get('/api/profile', {
        headers: { Authorization: `${token}` },
      });
      setUserData(response.data);
      setEditedData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Error fetching profile data');
      setLoading(false);
    }
  };

  const handleEditClick = () => {
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditedData(userData);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSaveChanges = async () => {
    try {
      const token = window.localStorage.getItem('token');
      await axios.put('/api/admin/profile', editedData, {
        headers: { Authorization: `${token}` },
      });
      setUserData(editedData);
      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating user data:', error);
      toast.error('Error updating profile');
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Admin"}
      userRole="Site Administrator"
      dashboardTitle="My Profile"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaUserShield style={{ color: '#2563eb' }} />
          My Profile
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View and edit your profile information
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : userData ? (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', maxWidth: '800px' }}>
          {!editMode ? (
            <>
              {/* View Mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{ 
                  width: '100px', 
                  height: '100px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '2.5rem',
                  fontWeight: 'bold'
                }}>
                  {userData.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                    {userData.name}
                  </h3>
                  <p style={{ color: '#64748b', marginBottom: '0' }}>Site Administrator</p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1.5rem' }}>
                <div style={{ borderLeft: '4px solid #2563eb', paddingLeft: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FaUser style={{ color: '#2563eb', fontSize: '1.25rem' }} />
                    <span style={{ fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Full Name</span>
                  </div>
                  <p style={{ fontSize: '1.125rem', color: '#1e293b', marginBottom: '0', paddingLeft: '2rem' }}>{userData.name}</p>
                </div>

                <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FaEnvelope style={{ color: '#10b981', fontSize: '1.25rem' }} />
                    <span style={{ fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Email Address</span>
                  </div>
                  <p style={{ fontSize: '1.125rem', color: '#1e293b', marginBottom: '0', paddingLeft: '2rem' }}>{userData.email}</p>
                </div>

                <div style={{ borderLeft: '4px solid #f59e0b', paddingLeft: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FaMapMarkerAlt style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                    <span style={{ fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Address</span>
                  </div>
                  <p style={{ fontSize: '1.125rem', color: '#1e293b', marginBottom: '0', paddingLeft: '2rem' }}>{userData.address || 'Not provided'}</p>
                </div>

                <div style={{ borderLeft: '4px solid #8b5cf6', paddingLeft: '1rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FaPhone style={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
                    <span style={{ fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase' }}>Phone Number</span>
                  </div>
                  <p style={{ fontSize: '1.125rem', color: '#1e293b', marginBottom: '0', paddingLeft: '2rem' }}>{userData.cellphone || 'Not provided'}</p>
                </div>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-primary" onClick={handleEditClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FaEdit /> Edit Profile
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Edit Mode */}
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaEdit /> Edit Profile
              </h3>
              <form>
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label><FaUser style={{ marginRight: '0.5rem', color: '#2563eb' }} />Name:</label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={editedData.name || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label><FaEnvelope style={{ marginRight: '0.5rem', color: '#10b981' }} />Email:</label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={editedData.email || ''}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label><FaMapMarkerAlt style={{ marginRight: '0.5rem', color: '#f59e0b' }} />Address:</label>
                    <input
                      type="text"
                      name="address"
                      className="form-control"
                      value={editedData.address || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label><FaPhone style={{ marginRight: '0.5rem', color: '#8b5cf6' }} />Cellphone:</label>
                    <input
                      type="text"
                      name="cellphone"
                      className="form-control"
                      value={editedData.cellphone || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-success" onClick={handleSaveChanges} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaSave /> Save Changes
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaTimes /> Cancel
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : (
        <p style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Unable to load profile data</p>
      )}
    </DashboardLayout>
  );
}

export default ViewAdminProfile;
