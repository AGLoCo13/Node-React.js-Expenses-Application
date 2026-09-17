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
    building: '', tenant: '', floor: '', name: '', square_meters: '', owner: false, fi: '', ei: ''
  });
  const [selectedApartment, setSelectedApartment] = useState(null);
  const [editApartment, setEditApartment] = useState({
    building: '', tenant: '', floor: '', name: '', square_meters: '', owner: '', fi: '', ei: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [tenants, setTenants] = useState([]);
  const [buildingFilter, setBuildingFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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
        building: '', tenant: '', name: '', floor: '', square_meters: '', owner: false, fi: '', ei: ''
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
      ei: apartment.ei || ''
    });
    setShowEditForm(true);
    setShowCreateForm(false);
  };

  const UpdateApartment = async (e) => {
    e.preventDefault();
    try {
      const { building, tenant, name, floor, square_meters, owner, fi, ei } = editApartment;
      await axios.put(`/api/apartments/${selectedApartment._id}`, {
        building, tenant, name, floor, square_meters, owner, fi, ei
      });
      setSelectedApartment(null);
      setEditApartment({
        building: '', tenant: '', name: '', floor: '', square_meters: '', owner: '', fi: '', ei: ''
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

  const filteredApartments = apartments.filter(apt => {
    if (buildingFilter === 'All') return true;
    const bId = apt.building?._id || apt.building;
    return bId === buildingFilter;
  });

  const totalPages = Math.ceil(filteredApartments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentApartments = filteredApartments.slice(startIndex, startIndex + itemsPerPage);

  const handleBuildingFilterChange = (e) => {
    setBuildingFilter(e.target.value);
    setCurrentPage(1);
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
              <div className="col-md-4 form-group">
                <label>Owner:</label>
                <select className="form-control" name="owner" value={(showEditForm ? editApartment.owner : newApartment.owner).toString()} onChange={handleInputChange} required>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="col-md-4 form-group">
                <label title="Συντελεστής θέσης (0.20-0.35) - χαμηλότερα για ισόγειο">
                  Position Factor (fi):
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  name="fi" 
                  placeholder="e.g. 0.25 for ground floor" 
                  value={showEditForm ? editApartment.fi : newApartment.fi} 
                  onChange={handleInputChange} 
                  required 
                  title="Συντελεστής θέσης διαμερίσματος (0.20-0.35)"
                />
                <small className="form-text text-muted">Ground floor: 0.25, Mid floors: 0.30, Top floor: 0.35</small>
              </div>
              <div className="col-md-4 form-group">
                <label title="Συντελεστής όγκου (0.40-0.85) - από μελέτη μηχανολόγου">
                  Volume Factor (ei):
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="form-control" 
                  name="ei" 
                  placeholder="e.g. 0.65" 
                  value={showEditForm ? editApartment.ei : newApartment.ei} 
                  onChange={handleInputChange} 
                  required 
                  title="Συντελεστής όγκου από μελέτη θέρμανσης (0.40-0.85)"
                />
                <small className="form-text text-muted">From heating study - typically 0.40-0.85</small>
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

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', padding: '1.5rem', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' }}>
        
        {/* Header: Τίτλος & Επιλογή Κτιρίου (Αριστερά) */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'flex-start', 
          alignItems: 'center', 
          marginBottom: '1.5rem',
          width: '100%',
          gap: '1.5rem',
          paddingLeft: '0.5rem',
          paddingRight: '0.5rem',
          flexWrap: 'wrap'
        }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', margin: 0 }}>
            Apartments List ({filteredApartments.length})
          </h3>
          
          <select
            value={buildingFilter}
            onChange={handleBuildingFilterChange}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              border: '1px solid #cbd5e1',
              outline: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              minWidth: '240px'
            }}
          >
            <option value="All">All Buildings (Select Building)</option>
            {buildings.map((b) => (
              <option key={b._id} value={b._id}>
                {b.address}
              </option>
            ))}
          </select>
        </div>

        {/* Πίνακας */}
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
              {currentApartments.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    No apartments found.
                  </td>
                </tr>
              ) : (
                currentApartments.map((apartment) => (
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Κουμπιά Paging (Αριστερά) */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '1.5rem',
          paddingLeft: '0.5rem'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn btn-sm btn-light"
            style={{ border: '1px solid #cbd5e1' }}
          >
            Previous
          </button>
          
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Page <strong style={{ color: '#1e293b' }}>{currentPage}</strong> of <strong>{totalPages || 1}</strong>
          </span>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="btn btn-sm btn-light"
            style={{ border: '1px solid #cbd5e1' }}
          >
            Next
          </button>
        </div>

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
