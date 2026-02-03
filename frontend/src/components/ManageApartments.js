import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { FaHome, FaUsers, FaBuilding, FaDoorOpen, FaUserShield, FaEdit, FaTrash, FaPlus, FaRulerCombined, FaFire, FaArrowUp } from 'react-icons/fa';
import DashboardLayout from './DashboardLayout';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-toastify';
import 'bootstrap/dist/css/bootstrap.min.css';

function ManageApartments() {
  const [buildings, setBuildings] = useState([]);
  const [apartments, setApartments] = useState([]);
  const [newApartment, setNewApartment] = useState({
    building: '', tenant: '', floor: '', name: '', square_meters: '', owner: '', fi: '', heating: '', elevator: '', general_expenses: ''
  });
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [editApartment, setEditApartment] = useState({
    building: '', tenant: '', floor: '', name: '', square_meters: '', owner: '', fi: '', heating: '', elevator: '', general_expenses: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [tenants, setTenants] = useState([]);

  const navItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: FaHome },
    { label: 'Manage Users', path: '/admin-dashboard/manage-users', icon: FaUsers },
    { label: 'Manage Buildings', path: '/admin-dashboard/manage-buildings', icon: FaBuilding },
    { label: 'Manage Apartments', path: '/admin-dashboard/manage-apartments', icon: FaDoorOpen },
    { label: 'Profile', path: '/admin-dashboard/profile', icon: FaUserShield }
  ];

  useEffect(() => {
    fetchTenants();
    fetchBuildings();
    fetchApartments();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await axios.get('/api/tenants');
      const { tenants } = response.data;
      setTenants(tenants);
    } catch (error) {
      console.error('Error fetching Tenants:', error);
      toast.error('Error fetching tenants');
    }
  };

  const fetchBuildings = async () => {
    try {
      const response = await axios.get("/api/buildings");
      setBuildings(response.data);
    } catch (error) {
      console.error("Error fetching Buildings:", error);
      toast.error("Error fetching buildings");
    }
  };

  const fetchApartments = async () => {
    try {
      const response = await axios.get('/api/apartments');
      const { apartments } = response.data;
      setApartments(apartments);
    } catch (error) {
      console.error("Error fetching Apartments:", error);
      toast.error("Error fetching apartments");
    }
  };

  const CreateApartment = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/apartments", newApartment);
      setNewApartment({
        building: '', tenant: '', name: '', floor: '', square_meters: '', owner: '', fi: '', heating: '', elevator: '', general_expenses: ''
      });
      fetchApartments();
      setShowCreateForm(false);
      toast.success('Apartment Created Successfully!');
    } catch (error) {
      console.error('Error creating apartment:', error.response?.data);
      toast.error("Error creating Apartment");
    }
  };

  const selectApartment = (apartment) => {
    setSelectedApartment(apartment);
    setEditApartment({
      building: apartment.building,
      tenant: apartment.tenant,
      name: apartment.name,
      floor: apartment.floor,
      square_meters: apartment.square_meters,
      owner: apartment.owner,
      fi: apartment.fi,
      heating: apartment.heating,
      elevator: apartment.elevator,
      general_expenses: apartment.general_expenses
    });
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const UpdateApartment = async (e) => {
    e.preventDefault();
    try {
      const { building, tenant, name, floor, square_meters, owner, fi, heating, elevator, general_expenses } = editApartment;
      await axios.put(`/api/apartments/${selectedApartment._id}`, {
        building, tenant, name, floor, square_meters, owner, fi, heating, elevator, general_expenses
      });
      setSelectedApartment(null);
      setEditApartment({
        building: '', tenant: '', name: '', floor: '', square_meters: '', owner: '', fi: '', heating: '', elevator: '', general_expenses: ''
      });
      setShowEditForm(false);
      fetchApartments();
      toast.success('Apartment Updated successfully!');
    } catch (error) {
      console.error('Error updating apartment:', error);
      toast.error('Error updating Apartment!');
    }
  };

  const deleteApartment = (apartment) => {
    setSelectedApartment(apartment);
    setShowConfirmation(true);
  };

  const handleDeleteConfirmation = async (confirmed) => {
    if (confirmed && selectedApartment) {
      try {
        await axios.delete(`/api/apartments/${selectedApartment._id}`);
        fetchApartments();
        toast.success('Apartment deleted successfully!');
      } catch (error) {
        console.error('Error deleting apartment:', error);
        toast.error('Error deleting Apartment!');
      }
    }
    setShowConfirmation(false);
    setSelectedApartment(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newValue = name === 'owner' ? value === 'true' : value;
    if (selectedApartment) {
      setEditApartment((prev) => ({ ...prev, [name]: newValue }));
    } else {
      setNewApartment((prev) => ({ ...prev, [name]: newValue }));
    }
  };

  return (
    <DashboardLayout
      navItems={navItems}
      userName="Admin"
      userRole="Site Administrator"
      dashboardTitle="Manage Apartments"
    >
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <FaDoorOpen style={{ color: '#f59e0b' }} />
          Manage Apartments
        </h2>
        <p style={{ color: '#64748b', fontSize: '1rem' }}>
          Create, edit, and manage apartments in your buildings
        </p>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || showEditForm) && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {showEditForm ? <><FaEdit /> Edit Apartment: {selectedApartment?.name}</> : <><FaPlus /> Create New Apartment</>}
          </h3>
          <form onSubmit={showEditForm ? UpdateApartment : CreateApartment}>
            <div className="row">
              <div className="col-md-6 form-group">
                <label><FaBuilding style={{ marginRight: '0.5rem', color: '#f59e0b' }} />Building:</label>
                <select name="building" className="form-control" value={showEditForm ? editApartment.building : newApartment.building} onChange={handleInputChange} required>
                  <option value="">Select a Building</option>
                  {buildings.map((building) => (
                    <option key={building._id} value={building._id}>Address: {building.address}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6 form-group">
                <label><FaUserShield style={{ marginRight: '0.5rem', color: '#f59e0b' }} />Tenant:</label>
                <select name="tenant" className="form-control" value={showEditForm ? editApartment.tenant : newApartment.tenant} onChange={handleInputChange} required>
                  <option value="">Select a Tenant</option>
                  {tenants.map((tenant) => (
                    <option key={tenant._id} value={tenant._id}>{tenant?.user?.name || tenant.address}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4 form-group">
                <label><FaDoorOpen style={{ marginRight: '0.5rem', color: '#f59e0b' }} />Name:</label>
                <input type="text" className="form-control" name="name" value={showEditForm ? editApartment.name : newApartment.name} onChange={handleInputChange} required />
              </div>
              <div className="col-md-4 form-group">
                <label>Floor:</label>
                <input type="number" className="form-control" name="floor" value={showEditForm ? editApartment.floor : newApartment.floor} onChange={handleInputChange} required />
              </div>
              <div className="col-md-4 form-group">
                <label><FaRulerCombined style={{ marginRight: '0.5rem', color: '#f59e0b' }} />Square Meters:</label>
                <input type="number" className="form-control" name="square_meters" value={showEditForm ? editApartment.square_meters : newApartment.square_meters} onChange={handleInputChange} required />
              </div>
              <div className="col-md-3 form-group">
                <label>Owner:</label>
                <select className="form-control" name="owner" value={(showEditForm ? editApartment.owner : newApartment.owner).toString()} onChange={handleInputChange} required>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="col-md-3 form-group">
                <label>Load Factor (fi):</label>
                <input type="number" step="0.01" className="form-control" name="fi" placeholder="0.6 for ground floor" value={showEditForm ? editApartment.fi : newApartment.fi} onChange={handleInputChange} required />
              </div>
              <div className="col-md-2 form-group">
                <label><FaFire style={{ marginRight: '0.5rem', color: '#ef4444' }} />Heating:</label>
                <input type="number" className="form-control" name="heating" value={showEditForm ? editApartment.heating : newApartment.heating} onChange={handleInputChange} />
              </div>
              <div className="col-md-2 form-group">
                <label><FaArrowUp style={{ marginRight: '0.5rem', color: '#3b82f6' }} />Elevator:</label>
                <input type="number" className="form-control" name="elevator" value={showEditForm ? editApartment.elevator : newApartment.elevator} onChange={handleInputChange} />
              </div>
              <div className="col-md-2 form-group">
                <label>General:</label>
                <input type="number" className="form-control" name="general_expenses" value={showEditForm ? editApartment.general_expenses : newApartment.general_expenses} onChange={handleInputChange} />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-warning">
                {showEditForm ? 'Update Apartment' : 'Create Apartment'}
              </button>
              {showEditForm && (
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditForm(false); setSelectedApartment(null); setShowCreateForm(true); }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Apartments Table */}
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1.5rem' }}>
          Apartments List ({apartments.length})
        </h3>
        {apartments && apartments.length > 0 ? (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th>Name</th>
                  <th>Building Address</th>
                  <th>Floor</th>
                  <th>Tenant</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apartments.map((apartment) => (
                  <tr key={apartment._id}>
                    <td style={{ fontWeight: '500' }}>{apartment.name}</td>
                    <td>{apartment.building?.address || 'No Building'}</td>
                    <td>{apartment.floor}</td>
                    <td>{apartment.tenant?.user?.name || 'N/A'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" style={{ marginRight: '0.5rem' }} onClick={() => selectApartment(apartment)}>
                        <FaEdit /> Edit
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteApartment(apartment)}>
                        <FaTrash /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No apartments found</p>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        show={showConfirmation}
        title="Delete Apartment"
        message={`Are you sure you want to delete apartment ${selectedApartment?.name}? This action cannot be undone.`}
        onConfirm={() => handleDeleteConfirmation(true)}
        onCancel={() => handleDeleteConfirmation(false)}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </DashboardLayout>
  );
}

export default ManageApartments;
