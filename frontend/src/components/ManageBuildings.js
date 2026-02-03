import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FaHome, FaUsers, FaBuilding, FaDoorOpen, FaUserShield, FaEdit, FaTrash, FaPlus, FaMapMarkerAlt, FaLayerGroup } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ManageBuildings() {
  const [buildings, setBuildings] = useState([]);
  const [newBuilding, setNewBuilding] = useState({ profile: '', address: '', floors: '', apartments: '', reserve: '' });
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [editBuilding, setEditBuilding] = useState({ profile: '', address: '', floors: '', apartments: '', reserve: '' });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [administrators, setAdministrators] = useState(null);
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
    fetchAdministrators();
    fetchBuildings();
  }, []);

  const fetchAdministrators = async () => {
    try {
      const response = await axios.get("/api/administrators");
      const { administrators } = response.data;
      setAdministrators(administrators);
    } catch (error) {
      console.error("Error fetching administrators:", error);
      toast.error("Error fetching administrators");
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await axios.get('/api/buildings');
      setBuildings(response.data);
    } catch (error) {
      console.error("Error fetching Buildings:", error);
      toast.error("Error fetching buildings");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (selectedBuilding) {
      setEditBuilding((prev) => ({ ...prev, [name]: value }));
    } else {
      setNewBuilding((prev) => ({ ...prev, [name]: value }));
    }
  };

  const CreateBuilding = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/buildings', newBuilding);
      setNewBuilding({ profile: '', address: '', floors: '', apartments: '', reserve: '' });
      fetchBuildings();
      setShowCreateForm(false);
      toast.success("Building Created Successfully!");
    } catch (error) {
      console.error('Error creating building:', error.response?.data);
      toast.error("Error creating Building!");
    }
  };

  const selectBuilding = (building) => {
    setSelectedBuilding(building);
    setEditBuilding({
      profile: building.profile,
      address: building.address,
      floors: building.floors,
      apartments: building.apartments,
      reserve: building.reserve
    });
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const UpdateBuilding = async (e) => {
    e.preventDefault();
    try {
      const { profile, address, floors, apartments, reserve } = editBuilding;
      await axios.put(`/api/buildings/${selectedBuilding._id}`, { profile, address, floors, apartments, reserve });
      setSelectedBuilding(null);
      setEditBuilding({ profile: '', address: '', floors: '', apartments: '', reserve: '' });
      setShowEditForm(false);
      fetchBuildings();
      toast.success('Building updated Successfully!');
    } catch (error) {
      console.error('Error updating building:', error);
      toast.error('Error updating Building!');
    }
  };

  const DeleteBuilding = (building) => {
    setSelectedBuilding(building);
    setShowConfirmation(true);
  };

  const handleDeleteConfirmation = async (confirmed) => {
    if (confirmed && selectedBuilding) {
      try {
        await axios.delete(`/api/buildings/${selectedBuilding._id}`);
        fetchBuildings();
        toast.success('Building deleted successfully!');
      } catch (error) {
        console.error('Error deleting building:', error);
        toast.error("Error deleting Building!");
      }
    }
    setShowConfirmation(false);
    setSelectedBuilding(null);
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Admin"
      userRole="Site Administrator"
      dashboardTitle="Manage Buildings"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaBuilding style={{ color: '#10b981' }} />
          Manage Buildings
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Create, edit, and manage buildings and assign administrators
        </p>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || showEditForm) && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {showEditForm ? <><FaEdit /> Edit Building: {selectedBuilding?.address}</> : <><FaPlus /> Create New Building</>}
          </h3>
          <form onSubmit={showEditForm ? UpdateBuilding : CreateBuilding}>
            <div className="row">
              <div className="col-md-6 form-group">
                <label><FaUserShield style={{ marginRight: '0.5rem', color: '#10b981' }} />Administrator:</label>
                <select
                  name="profile"
                  className="form-control"
                  value={showEditForm ? editBuilding.profile : newBuilding.profile}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select an administrator</option>
                  {administrators ? (
                    administrators.map((administrator) => (
                      <option key={administrator._id} value={administrator._id}>
                        {administrator.user.name}
                      </option>
                    ))
                  ) : (
                    <option>Loading...</option>
                  )}
                </select>
              </div>
              <div className="col-md-6 form-group">
                <label><FaMapMarkerAlt style={{ marginRight: '0.5rem', color: '#10b981' }} />Address:</label>
                <input
                  type="text"
                  className="form-control"
                  name="address"
                  value={showEditForm ? editBuilding.address : newBuilding.address}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4 form-group">
                <label><FaLayerGroup style={{ marginRight: '0.5rem', color: '#10b981' }} />Floors:</label>
                <input
                  type="number"
                  className="form-control"
                  name="floors"
                  value={showEditForm ? editBuilding.floors : newBuilding.floors}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4 form-group">
                <label><FaDoorOpen style={{ marginRight: '0.5rem', color: '#10b981' }} />Apartments:</label>
                <input
                  type="number"
                  className="form-control"
                  name="apartments"
                  value={showEditForm ? editBuilding.apartments : newBuilding.apartments}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="col-md-4 form-group">
                <label><FaBuilding style={{ marginRight: '0.5rem', color: '#10b981' }} />Reserve:</label>
                <input
                  type="text"
                  className="form-control"
                  name="reserve"
                  value={showEditForm ? editBuilding.reserve : newBuilding.reserve}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-success">
                {showEditForm ? 'Update Building' : 'Create Building'}
              </button>
              {showEditForm && (
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditForm(false); setSelectedBuilding(null); setShowCreateForm(true); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Buildings Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
          Buildings List ({buildings.length})
        </h3>
        {buildings && buildings.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th>Address</th>
                  <th>Administrator</th>
                  <th>Floors</th>
                  <th>Apartments</th>
                  <th>Reserve</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((building) => (
                  <tr key={building._id}>
                    <td style={{ fontWeight: '500' }}>{building.address}</td>
                    <td>{building.profile?.user?.name || 'N/A'}</td>
                    <td>{building.floors}</td>
                    <td>{building.apartments}</td>
                    <td>{building.reserve}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" style={{ marginRight: '0.5rem' }} onClick={() => selectBuilding(building)}>
                        <FaEdit /> Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => DeleteBuilding(building)}>
                        <FaTrash /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No buildings found</p>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        show={showConfirmation}
        title="Delete Building"
        message={`Are you sure you want to delete the building at ${selectedBuilding?.address}? This action cannot be undone.`}
        onConfirm={() => handleDeleteConfirmation(true)}
        onCancel={() => handleDeleteConfirmation(false)}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </DashboardLayout>
  );
}

export default ManageBuildings;
