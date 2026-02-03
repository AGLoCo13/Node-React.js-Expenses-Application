import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUser, FaEnvelope, FaMapMarkerAlt, FaPhone, FaEdit, FaSave, FaTimes, FaDoorOpen, FaLayerGroup, FaRulerCombined, FaKey, FaFire, FaArrowUp, FaBriefcase } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function TenantView() {
  const [userData, setUserData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedData, setEditedData] = useState([]);
  const [apartmentData, setApartmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const navItems = [
    { label: 'Dashboard', path: '/tenant-dashboard', icon: FaHome },
    { label: 'View Profile', path: '/tenant-dashboard/view-page', icon: FaUser },
    { label: 'My Payments', path: '/tenant-dashboard/view-payments', icon: FaDoorOpen }
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

      const apartmentResponse = await axios.get(`/api/apartment/${response.data.profileId}`, {
        headers: { Authorization: `${token}` },
      });
      setApartmentData(apartmentResponse.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Error loading profile data');
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
    setSaving(true);
    try {
      const token = window.localStorage.getItem('token');
      await axios.put('/api/tenant/profile', editedData, {
        headers: { Authorization: `${token}` },
      });
      setUserData(editedData);
      setEditMode(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName={userData?.name || "Tenant"}
      userRole="Tenant"
      dashboardTitle="My Profile"
    >
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaUser style={{ color: '#2563eb' }} />
          {editMode ? 'Edit Profile' : 'My Profile'}
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          View and manage your profile information
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="sr-only">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {/* User Profile Section */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '0.75rem', 
            padding: '2rem', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
              User Information
            </h3>

            {!editMode ? (
              <>
                <div className="row">
                  <div className="col-md-6" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FaUser style={{ color: '#2563eb', fontSize: '1.25rem' }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Name</p>
                        <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{userData?.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FaEnvelope style={{ color: '#10b981', fontSize: '1.25rem' }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Email</p>
                        <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{userData?.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FaMapMarkerAlt style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Address</p>
                        <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{userData?.address}</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FaPhone style={{ color: '#3b82f6', fontSize: '1.25rem' }} />
                      <div>
                        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Cellphone</p>
                        <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{userData?.cellphone}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={handleEditClick} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FaEdit /> Edit Profile
                  </button>
                </div>
              </>
            ) : (
              <form>
                <div className="row">
                  <div className="col-md-6 form-group">
                    <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaUser style={{ color: '#2563eb' }} />
                      Name:
                    </label>
                    <input
                      type="text"
                      name="name"
                      className="form-control"
                      value={editedData.name || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaEnvelope style={{ color: '#10b981' }} />
                      Email:
                    </label>
                    <input
                      type="email"
                      name="email"
                      className="form-control"
                      value={editedData.email || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaMapMarkerAlt style={{ color: '#f59e0b' }} />
                      Address:
                    </label>
                    <input
                      type="text"
                      name="address"
                      className="form-control"
                      value={editedData.address || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="col-md-6 form-group">
                    <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FaPhone style={{ color: '#3b82f6' }} />
                      Cellphone:
                    </label>
                    <input
                      type="tel"
                      name="cellphone"
                      className="form-control"
                      value={editedData.cellphone || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveChanges}
                    disabled={saving}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave /> Save Changes
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <FaTimes /> Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Apartment Details Section */}
          {apartmentData && (
            <div style={{ 
              backgroundColor: 'white', 
              borderRadius: '0.75rem', 
              padding: '2rem', 
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
                Apartment Details
              </h3>
              <div className="row">
                <div className="col-md-4" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaDoorOpen style={{ color: '#f59e0b', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Name</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.name}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaLayerGroup style={{ color: '#3b82f6', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Floor</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.floor}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-4" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaRulerCombined style={{ color: '#10b981', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Square Meters</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.square_meters} m²</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaKey style={{ color: '#8b5cf6', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Owner</p>
                      <span className={`badge ${apartmentData.owner ? 'badge-success' : 'badge-secondary'}`}>
                        {apartmentData.owner ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="col-md-3" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaFire style={{ color: '#ef4444', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Heating Factor</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.heating}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaArrowUp style={{ color: '#3b82f6', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Elevator Factor</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.elevator}</p>
                    </div>
                  </div>
                </div>
                <div className="col-md-3" style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <FaBriefcase style={{ color: '#10b981', fontSize: '1.25rem' }} />
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>General Expenses</p>
                      <p style={{ fontWeight: '600', color: '#1e293b', marginBottom: 0 }}>{apartmentData.general_expenses}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}

export default TenantView;
